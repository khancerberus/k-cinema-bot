import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import Redis from 'ioredis';
import { TmdbService } from '@/tmdb/tmdb.service';
import type { Movie } from '@/tmdb/movie.interface';
import { MovieMetadata } from './movie-metadata.model';

// Lo único que se guarda en Redis de cada película: un subconjunto de la respuesta de TMDB
// con sus mismos nombres de campo, para que cualquier versión del código que lea la caché
// (p. ej. la desplegada mientras se prueba otra en local) la entienda.
export interface CachedMovie {
  title: string;
  original_title: string;
  release_date: string;
  overview: string;
  poster_path: string | null;
  // Solo los directores
  credits: { crew: Array<{ job: string; name: string }> };
}

const CACHE_TTL_SECONDS = 365 * 24 * 60 * 60;
// Las filas de Movies se refrescan desde TMDB cuando tienen más de 30 días
const METADATA_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const BACKFILL_CONCURRENCY = 5;

const cacheKey = (tmdbId: number) => `tmdb:movie:${tmdbId}`;

const slimMovie = (movie: Movie | CachedMovie): CachedMovie => ({
  title: movie.title,
  original_title: movie.original_title,
  release_date: movie.release_date ?? '',
  overview: movie.overview ?? '',
  poster_path: movie.poster_path ?? null,
  credits: {
    crew:
      movie.credits?.crew
        ?.filter((member) => member.job === 'Director')
        .map(({ job, name }) => ({ job, name })) ?? [],
  },
});

// Entradas antiguas: la respuesta completa de TMDB (con reparto, géneros, etc.)
const isFullTmdbEntry = (value: object) =>
  'genres' in value ||
  ('credits' in value &&
    Boolean((value as { credits?: { cast?: unknown } }).credits?.cast));

// Formato intermedio que se usó brevemente ({ releaseDate, posterPath, directors... }): se convierte
interface InterimCachedMovie {
  title: string;
  originalTitle: string;
  releaseDate: string;
  overview: string;
  posterPath: string | null;
  directors: string[];
}

const isInterimEntry = (value: object): value is InterimCachedMovie =>
  'directors' in value;

const fromInterim = (value: InterimCachedMovie): CachedMovie => ({
  title: value.title,
  original_title: value.originalTitle,
  release_date: value.releaseDate,
  overview: value.overview,
  poster_path: value.posterPath,
  credits: {
    crew: value.directors.map((name) => ({ job: 'Director', name })),
  },
});

export const directorsOf = (movie: CachedMovie | null | undefined) =>
  movie?.credits?.crew
    ?.filter((member) => member.job === 'Director')
    .map((member) => member.name) ?? [];

export const releaseYearOf = (movie: CachedMovie | null) => {
  const year = Number(movie?.release_date?.split('-')[0]);
  return Number.isInteger(year) && year > 0 ? year : null;
};

@Injectable()
export class MovieService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MovieService.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @InjectModel(MovieMetadata)
    private readonly movieModel: typeof MovieMetadata,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly tmdbService: TmdbService,
  ) {}

  // Datos de TMDB desde Redis, o desde TMDB si no están (o si fresh = true)
  async getCached(tmdbId: number, fresh = false): Promise<CachedMovie | null> {
    if (!fresh) {
      const cached = await this.redis.get(cacheKey(tmdbId));
      if (cached) return this.parseCached(tmdbId, cached);
    }

    const movie = await this.tmdbService.getMovie(tmdbId);
    if (!movie) return null;

    const slim = slimMovie(movie);
    await this.redis.set(
      cacheKey(tmdbId),
      JSON.stringify(slim),
      'EX',
      CACHE_TTL_SECONDS,
    );
    return slim;
  }

  // Varias películas con un solo MGET; las que falten se piden a TMDB
  async getCachedMany(tmdbIds: number[]): Promise<Map<number, CachedMovie>> {
    const result = new Map<number, CachedMovie>();
    if (!tmdbIds.length) return result;

    const values = await this.redis.mget(tmdbIds.map(cacheKey));
    await Promise.all(
      tmdbIds.map(async (tmdbId, index) => {
        const raw = values[index];
        const movie = raw
          ? await this.parseCached(tmdbId, raw)
          : await this.getCached(tmdbId);
        if (movie) result.set(tmdbId, movie);
      }),
    );
    return result;
  }

  // Asegura que la película está en Movies y que sus datos no tienen más de 30 días
  async syncMetadata(tmdbId: number): Promise<void> {
    const row = await this.movieModel.findOne({
      where: { mediaType: 'movie', tmdbId },
    });
    const isFresh =
      row && Date.now() - row.updatedAt.getTime() < METADATA_MAX_AGE_MS;
    if (isFresh) return;

    // Si la fila existe pero caducó, se consulta TMDB directamente (Redis podría tener lo mismo)
    const movie = await this.getCached(tmdbId, Boolean(row));
    if (!movie) return;

    await this.movieModel.upsert({
      mediaType: 'movie',
      tmdbId,
      title: movie.title.slice(0, 300),
      originalTitle: movie.original_title?.slice(0, 300) || null,
      releaseYear: releaseYearOf(movie),
      director: directorsOf(movie).join(', ').slice(0, 300) || null,
    });
  }

  // Igual que syncMetadata pero sin bloquear ni lanzar errores (para usar tras responder)
  syncMetadataInBackground(tmdbIds: number[]) {
    void this.runWithConcurrency(tmdbIds, (tmdbId) =>
      this.syncMetadata(tmdbId),
    );
  }

  isStale(updatedAt: Date | null) {
    return (
      !updatedAt || Date.now() - updatedAt.getTime() >= METADATA_MAX_AGE_MS
    );
  }

  // Al arrancar, añade a Movies las películas puntuadas que aún no tienen fila
  onApplicationBootstrap() {
    void this.backfill();
  }

  private async backfill() {
    try {
      const missing = await this.sequelize.query<{ tmdbId: number }>(
        `SELECT DISTINCT s."tmdbId"
           FROM "Stars" s
           LEFT JOIN "Movies" m ON m."mediaType" = 'movie' AND m."tmdbId" = s."tmdbId"
          WHERE s."mediaType" = 'movie' AND m."tmdbId" IS NULL`,
        { type: QueryTypes.SELECT },
      );
      if (!missing.length) return;

      this.logger.log(`Movies: completando ${missing.length} películas`);
      await this.runWithConcurrency(
        missing.map((row) => Number(row.tmdbId)),
        (tmdbId) => this.syncMetadata(tmdbId),
      );
      this.logger.log('Movies: índice completado');
    } catch (error) {
      this.logger.error('No se pudo completar Movies', error as Error);
    }
  }

  private async runWithConcurrency(
    tmdbIds: number[],
    task: (tmdbId: number) => Promise<void>,
  ) {
    const queue = [...new Set(tmdbIds)];
    const worker = async () => {
      for (let tmdbId = queue.shift(); tmdbId; tmdbId = queue.shift()) {
        try {
          await task(tmdbId);
        } catch (error) {
          this.logger.warn(
            `Película ${tmdbId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    };
    await Promise.all(
      Array.from({ length: BACKFILL_CONCURRENCY }, () => worker()),
    );
  }

  private async parseCached(tmdbId: number, raw: string): Promise<CachedMovie> {
    const value = JSON.parse(raw) as CachedMovie | InterimCachedMovie;
    if (!isInterimEntry(value) && !isFullTmdbEntry(value)) return value;

    // Respuesta completa de TMDB: se reescribe en la misma clave solo con lo necesario, conservando su TTL
    const slim = isInterimEntry(value) ? fromInterim(value) : slimMovie(value);
    const ttl = await this.redis.ttl(cacheKey(tmdbId));
    await this.redis.set(
      cacheKey(tmdbId),
      JSON.stringify(slim),
      'EX',
      ttl > 0 ? ttl : CACHE_TTL_SECONDS,
    );
    return slim;
  }
}
