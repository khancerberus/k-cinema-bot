import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CreateStarDto,
  MovieListQuery,
  MoviePage,
  MovieSortKey,
  SubmitStarDto,
} from './star.dto';
import { UserService } from '@/user/user.service';
import { CurrentMovieService } from './current-movie.service';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Star } from './star.model';
import { Op, QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import {
  MovieService,
  directorsOf,
  releaseYearOf,
  type CachedMovie,
} from '@/movie/movie.service';

export interface MovieStar {
  tmdbId: number;
  title: string;
  year: string;
  director: string;
  synopsis: string;
  rating: number;
  lastWatched: Date;
  posterUrl: string;
}

export interface StarRecord {
  tmdbId: number;
  score: number;
  createdAt: Date;
}

export interface MovieDetailResponse {
  tmdbId: number;
  title: string;
  year: string;
  director: string;
  rating: number;
  synopsis: string;
  lastWatched: string;
  posterUrl: string;
  stars: Array<{
    username: string;
    score: number;
    createdAt: Date;
  }>;
}

export interface SubmitStarResponse {
  message: string;
  currentMovie: Record<string, unknown>;
  stars: number;
}

interface RatedMovieRow {
  tmdbId: number;
  rating: number;
  lastWatched: Date;
  title: string | null;
  releaseYear: number | null;
  director: string | null;
  metadataUpdatedAt: Date | null;
  total: number;
}

// Columnas por las que se puede ordenar (lista blanca: nunca se interpola texto del usuario)
const SORT_COLUMNS: Record<MovieSortKey, string> = {
  title: 'lower(m."title")',
  rating: 'agg."rating"',
  lastWatched: 'agg."lastWatched"',
  year: 'm."releaseYear"',
};

// Búsqueda sin distinguir mayúsculas ni tildes
const normalize = (sql: string) =>
  `translate(lower(${sql}), 'áéíóúüñàèìòùâêîôûç', 'aeiouunaeiouaeiouc')`;
const SEARCH_COLUMNS = [
  'm."title"',
  'm."originalTitle"',
  'm."director"',
  'm."releaseYear"::text',
];

// Los comodines de LIKE escritos por el usuario se buscan literalmente
const escapeLike = (text: string) => text.replace(/[!%_]/g, (c) => `!${c}`);

const posterUrlOf = (movie: CachedMovie | null | undefined) =>
  movie?.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : 'No poster available';

@Injectable()
export class StarService {
  constructor(
    @InjectModel(Star)
    private starModel: typeof Star,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly currentMovieService: CurrentMovieService,
    private readonly userService: UserService,
    private readonly movieService: MovieService,
  ) {}

  async createStar(starData: CreateStarDto) {
    return this.starModel.create(starData);
  }

  async getStarsByMovie(channelId: string, tmdbId: number) {
    return this.starModel.findAll({
      where: { channelId, tmdbId },
      order: [['createdAt', 'DESC']],
    });
  }

  // Películas puntuadas de un canal: filtra, busca, ordena y pagina en la base de datos.
  // Solo las películas de la página piden sinopsis y póster a Redis.
  async getMovies(
    channelId: string,
    query: MovieListQuery,
  ): Promise<MoviePage<MovieStar>> {
    const emptyPage = {
      items: [],
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: 0,
    };
    const conditions: string[] = [];
    const replacements: Record<string, unknown> = {
      channelId,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    };

    if (query.q) {
      replacements.q = `%${escapeLike(query.q.toLowerCase())}%`;
      const matches = SEARCH_COLUMNS.map(
        (column) => `${normalize(column)} LIKE ${normalize(':q')} ESCAPE '!'`,
      );
      conditions.push(`(${matches.join(' OR ')})`);
    }

    const ranges: Array<[keyof MovieListQuery, string, string]> = [
      ['minRating', 'agg."rating"', '>='],
      ['maxRating', 'agg."rating"', '<='],
      ['watchedFrom', 'agg."lastWatched"', '>='],
      ['watchedTo', 'agg."lastWatched"', '<='],
      ['minYear', 'm."releaseYear"', '>='],
      ['maxYear', 'm."releaseYear"', '<='],
    ];
    for (const [key, column, operator] of ranges) {
      if (query[key] === undefined) continue;
      replacements[key] = query[key];
      conditions.push(`${column} ${operator} :${key}`);
    }

    if (query.ids) {
      if (!query.ids.length) return emptyPage;
      replacements.ids = query.ids;
      conditions.push('agg."tmdbId" IN (:ids)');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const direction = query.dir === 'asc' ? 'ASC' : 'DESC';
    const fromRatedMovies = (select: string) => `
      WITH agg AS (
        SELECT "tmdbId",
               ROUND(AVG("score")::numeric, 1)::float AS "rating",
               MAX("createdAt") AS "lastWatched"
          FROM "Stars"
         WHERE "channelId" = :channelId
         GROUP BY "tmdbId"
      )
      SELECT ${select}
        FROM agg
        LEFT JOIN "Movies" m ON m."mediaType" = 'movie' AND m."tmdbId" = agg."tmdbId"
      ${where}`;

    const rows = await this.sequelize.query<RatedMovieRow>(
      `${fromRatedMovies(`
         agg."tmdbId", agg."rating", agg."lastWatched",
         m."title", m."releaseYear", m."director", m."updatedAt" AS "metadataUpdatedAt",
         COUNT(*) OVER()::int AS "total"`)}
       ORDER BY ${SORT_COLUMNS[query.sort]} ${direction} NULLS LAST, agg."tmdbId" ${direction}
       LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT },
    );

    // Página fuera de rango: no hay filas de las que leer el total
    let total = rows[0]?.total ?? 0;
    if (!rows.length && query.page > 1) {
      const [count] = await this.sequelize.query<{ total: number }>(
        fromRatedMovies('COUNT(*)::int AS "total"'),
        { replacements, type: QueryTypes.SELECT },
      );
      total = count?.total ?? 0;
    }
    if (!rows.length)
      return {
        ...emptyPage,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      };

    const tmdbIds = rows.map((row) => Number(row.tmdbId));
    const details = await this.movieService.getCachedMany(tmdbIds);

    // Películas sin fila en Movies o con datos de más de 30 días: se actualizan tras responder
    this.movieService.syncMetadataInBackground(
      rows
        .filter((row) => this.movieService.isStale(row.metadataUpdatedAt))
        .map((row) => Number(row.tmdbId)),
    );

    const items = rows.map((row): MovieStar => {
      const tmdbId = Number(row.tmdbId);
      const movie = details.get(tmdbId);
      const year = row.releaseYear ?? releaseYearOf(movie ?? null);

      return {
        tmdbId,
        title: row.title || movie?.title || 'Unknown',
        year: year ? String(year) : 'Unknown',
        director: row.director || directorsOf(movie).join(', ') || 'Unknown',
        rating: Number(row.rating),
        synopsis: movie?.overview || 'No synopsis available',
        lastWatched: row.lastWatched,
        posterUrl: posterUrlOf(movie),
      };
    });

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async getMovieDetails(channelId: string, tmdbId: number) {
    const movieDetail = await this.movieService.getCached(tmdbId);
    const stars = await this.getStarsByMovie(channelId, tmdbId);
    const users = await this.userService.getAll();
    const year = releaseYearOf(movieDetail);

    return {
      tmdbId,
      title: movieDetail?.title || 'Unknown',
      year: year ? String(year) : 'Unknown',
      director: directorsOf(movieDetail).join(', ') || 'Unknown',
      rating:
        stars.length > 0
          ? Number(
              (
                stars.reduce((sum, s) => sum + Number(s.score), 0) /
                stars.length
              ).toFixed(1),
            )
          : 0,
      synopsis: movieDetail?.overview || 'No synopsis available',
      lastWatched:
        stars.length > 0
          ? stars[0].createdAt.toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
            })
          : 'Unknown',
      posterUrl: posterUrlOf(movieDetail),
      stars: stars.map((s) => {
        const user = users.find((u) => u.userId === s.userId);
        return {
          username: user?.username || 'Unknown',
          score: s.score,
          createdAt: s.createdAt,
        };
      }),
    };
  }

  async submitStar(submitStarDto: SubmitStarDto) {
    const currentMovie = await this.currentMovieService.getCurrentMovie(
      submitStarDto.channelId,
    );

    let user = await this.userService.getUserById(submitStarDto.userId);
    if (!user) {
      user = await this.userService.createUser({
        userId: submitStarDto.userId,
        username: submitStarDto.username,
      });
    } else {
      if (user.username !== submitStarDto.username) {
        user.username = submitStarDto.username;
        await user.save();
      }
    }

    const today = new Date();

    const existingStar = await this.starModel.findOne({
      where: {
        userId: user.userId,
        tmdbId: currentMovie.tmdbId,
        channelId: submitStarDto.channelId,
        createdAt: {
          [Op.gte]: new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
          ),
        },
      },
    });

    if (existingStar) {
      throw new BadRequestException(
        `${submitStarDto.username} ya ha dado ${existingStar.score} estrellas a "${currentMovie.title} (${currentMovie.releaseYear})" hoy. Solo se permite una valoración por película al día.`,
      );
    }

    await this.createStar({
      userId: user.userId,
      tmdbId: currentMovie.tmdbId,
      channelId: submitStarDto.channelId,
      mediaType: 'movie',
      score: submitStarDto.stars,
    });
    // La película puntuada queda en el índice de búsqueda (Movies)
    this.movieService.syncMetadataInBackground([currentMovie.tmdbId]);

    const fullStars = Math.floor(submitStarDto.stars);
    const hasHalfStar = submitStarDto.stars % 1 !== 0;
    const starsAsEmotes = `${'⭐'.repeat(fullStars)}${hasHalfStar ? '½' : ''}`;

    return {
      message: `${submitStarDto.username} ha dado ${starsAsEmotes} (${submitStarDto.stars}) estrellas a "${currentMovie.title} (${currentMovie.releaseYear})"`,
      currentMovie,
      stars: submitStarDto.stars,
    };
  }
}
