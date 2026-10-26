import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import Redis from 'ioredis';
import { IgdbService, type IgdbGame } from '@/igdb/igdb.service';
import { MovieMetadata } from './movie-metadata.model';

// Lo que se guarda en Redis de cada juego: la respuesta de IGDB con sus mismos campos
export type CachedGame = IgdbGame;

const CACHE_TTL_SECONDS = 365 * 24 * 60 * 60;
// Igual que las películas: las filas de Movies se refrescan cada 30 días
const METADATA_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const cacheKey = (igdbId: number) => `igdb:game:${igdbId}`;

export const developersOf = (game: CachedGame | null | undefined) =>
  game?.involved_companies
    ?.filter((company) => company.developer)
    .map((company) => company.company.name) ?? [];

const yearOf = (seconds: number) => new Date(seconds * 1000).getUTCFullYear();

// Año del lanzamiento completo (1.0): es el que se muestra y por el que se busca y ordena
export const gameReleaseYearOf = (game: CachedGame | null | undefined) =>
  game?.first_release_date ? yearOf(game.first_release_date) : null;

// Año del primer acceso anticipado, si lo hubo antes del 1.0 (solo para la página de detalle)
export const earlyAccessYearOf = (game: CachedGame | null | undefined) => {
  const dates =
    game?.release_dates
      ?.filter((release) => release.status?.name === 'Early Access')
      .map((release) => release.date)
      .filter((date): date is number => typeof date === 'number' && date > 0) ??
    [];
  if (!dates.length) return null;
  const year = yearOf(Math.min(...dates));
  const releaseYear = gameReleaseYearOf(game);
  return releaseYear === null || year < releaseYear ? year : null;
};

export const gameCoverUrlOf = (game: CachedGame | null | undefined) =>
  game?.cover?.image_id
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
    : null;

// Datos de juegos (IGDB) con caché en Redis y fila en el índice Movies (mediaType 'game')
@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @InjectModel(MovieMetadata)
    private readonly movieModel: typeof MovieMetadata,
    private readonly igdbService: IgdbService,
  ) {}

  async getCached(igdbId: number, fresh = false): Promise<CachedGame | null> {
    if (!fresh) {
      const cached = await this.redis.get(cacheKey(igdbId));
      if (cached) return JSON.parse(cached) as CachedGame;
    }

    const game = await this.igdbService.getGame(igdbId);
    if (!game) return null;
    await this.cache([game]);
    return game;
  }

  async getCachedMany(igdbIds: number[]): Promise<Map<number, CachedGame>> {
    const result = new Map<number, CachedGame>();
    if (!igdbIds.length) return result;

    const values = await this.redis.mget(igdbIds.map(cacheKey));
    await Promise.all(
      igdbIds.map(async (igdbId, index) => {
        const raw = values[index];
        const game = raw
          ? (JSON.parse(raw) as CachedGame)
          : await this.getCached(igdbId);
        if (game) result.set(igdbId, game);
      }),
    );
    return result;
  }

  // Los resultados de una búsqueda ya traen todos los campos: se guardan para no volver a pedirlos
  async cache(games: CachedGame[]) {
    if (!games.length) return;
    const pipeline = this.redis.pipeline();
    for (const game of games) {
      pipeline.set(
        cacheKey(game.id),
        JSON.stringify(game),
        'EX',
        CACHE_TTL_SECONDS,
      );
    }
    await pipeline.exec();
  }

  // En Movies, tmdbId guarda el ID de IGDB y director la desarrolladora
  async syncMetadata(igdbId: number): Promise<void> {
    const row = await this.movieModel.findOne({
      where: { mediaType: 'game', tmdbId: igdbId },
    });
    const isFresh =
      row && Date.now() - row.updatedAt.getTime() < METADATA_MAX_AGE_MS;
    if (isFresh) return;

    const game = await this.getCached(igdbId, Boolean(row));
    if (!game) return;

    await this.movieModel.upsert({
      mediaType: 'game',
      tmdbId: igdbId,
      title: game.name.slice(0, 300),
      originalTitle: null,
      releaseYear: gameReleaseYearOf(game),
      director: developersOf(game).join(', ').slice(0, 300) || null,
    });
  }

  syncMetadataInBackground(igdbIds: number[]) {
    void Promise.all(
      [...new Set(igdbIds)].map((igdbId) =>
        this.syncMetadata(igdbId).catch((error: unknown) =>
          this.logger.warn(
            `Juego ${igdbId}: ${error instanceof Error ? error.message : String(error)}`,
          ),
        ),
      ),
    );
  }
}
