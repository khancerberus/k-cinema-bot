import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CATEGORY_SORT_PATTERN,
  type ChatVoter,
  type MovieListQuery,
  type MoviePage,
} from './star.dto';
import { UserService } from '@/user/user.service';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Star } from './star.model';
import { StarScore } from './star-score.model';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { CatalogService, mediaLabel } from '@/movie/catalog.service';
import type { Channel } from '@/channel/channel.model';
import { resolveSettings, type MediaType } from '@/channel/channel.settings';
import {
  RatingSessionService,
  sessionStarsWhere,
} from './rating-session.service';
import { formatScores, parseScores, type ScoreCategory } from './star-input';

export interface CategoryAverage {
  key: string;
  label: string;
  average: number;
}

export interface MovieStar {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  year: string;
  // Directores (películas) o desarrolladoras (juegos)
  director: string;
  synopsis: string;
  rating: number;
  lastWatched: Date;
  posterUrl: string;
  sourceUrl: string | null;
  // Promedio de cada categoría (vacío si el contenido se puntúa con una sola nota)
  categories: CategoryAverage[];
}

export interface MovieDetailResponse {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  year: string;
  director: string;
  rating: number;
  synopsis: string;
  lastWatched: string;
  posterUrl: string;
  sourceUrl: string | null;
  platforms: string[];
  genres: string[];
  // Solo juegos: año del acceso anticipado, si lo hubo antes del 1.0
  earlyAccessYear: number | null;
  categories: CategoryAverage[];
  stars: Array<{
    username: string;
    score: number;
    // categoryKey → nota
    scores: Record<string, number>;
    createdAt: Date;
  }>;
}

export interface SubmitStarResponse {
  message: string;
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
const SORT_COLUMNS: Record<string, string> = {
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

const NO_POSTER = 'No poster available';

// Etiquetas de las categorías del canal, incluidas las archivadas (los votos antiguos las usan)
const categoryLabels = (channel: Channel, mediaType: MediaType) =>
  resolveSettings(channel.settings).rating.categories[mediaType];

@Injectable()
export class StarService {
  constructor(
    @InjectModel(Star)
    private starModel: typeof Star,
    @InjectModel(StarScore)
    private starScoreModel: typeof StarScore,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly ratingSessionService: RatingSessionService,
    private readonly userService: UserService,
    private readonly catalog: CatalogService,
  ) {}

  async getStarsByItem(
    channelId: string,
    mediaType: MediaType,
    tmdbId: number,
  ) {
    return this.starModel.findAll({
      where: { channelId, mediaType, tmdbId },
      include: [StarScore],
      order: [['createdAt', 'DESC']],
    });
  }

  // Contenido puntuado de un canal: filtra, busca, ordena y pagina en la base de datos.
  // Solo los de la página piden sinopsis y póster a Redis.
  async getMovies(
    channel: Channel,
    mediaType: MediaType,
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
      channelId: channel.channelId,
      mediaType,
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

    // Orden por una categoría: su promedio se calcula aparte y se une por tmdbId
    const sortCategory = CATEGORY_SORT_PATTERN.exec(query.sort)?.[1];
    if (sortCategory) replacements.sortCategory = sortCategory;
    const sortColumn = sortCategory
      ? 'cat."average"'
      : SORT_COLUMNS[query.sort];

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const direction = query.dir === 'asc' ? 'ASC' : 'DESC';
    const fromRatedMovies = (select: string) => `
      WITH agg AS (
        SELECT "tmdbId",
               ROUND(AVG("score")::numeric, 1)::float AS "rating",
               MAX("createdAt") AS "lastWatched"
          FROM "Stars"
         WHERE "channelId" = :channelId AND "mediaType" = :mediaType
         GROUP BY "tmdbId"
      )${
        sortCategory
          ? `, cat AS (
        SELECT s."tmdbId", AVG(ss."score") AS "average"
          FROM "Stars" s
          JOIN "StarScores" ss ON ss."starId" = s."id"
         WHERE s."channelId" = :channelId AND s."mediaType" = :mediaType
           AND ss."categoryKey" = :sortCategory
         GROUP BY s."tmdbId"
      )`
          : ''
      }
      SELECT ${select}
        FROM agg
        LEFT JOIN "Movies" m ON m."mediaType" = :mediaType AND m."tmdbId" = agg."tmdbId"
        ${sortCategory ? 'LEFT JOIN cat ON cat."tmdbId" = agg."tmdbId"' : ''}
      ${where}`;

    const rows = await this.sequelize.query<RatedMovieRow>(
      `${fromRatedMovies(`
         agg."tmdbId", agg."rating", agg."lastWatched",
         m."title", m."releaseYear", m."director", m."updatedAt" AS "metadataUpdatedAt",
         COUNT(*) OVER()::int AS "total"`)}
       ORDER BY ${sortColumn} ${direction} NULLS LAST, agg."tmdbId" ${direction}
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
    const [details, categories] = await Promise.all([
      this.catalog.getInfoMany(mediaType, tmdbIds),
      this.categoryAverages(channel, mediaType, tmdbIds),
    ]);

    // Sin fila en Movies o con datos de más de 30 días: se actualizan tras responder
    this.catalog.syncMetadataInBackground(
      mediaType,
      rows
        .filter((row) => this.catalog.isStale(row.metadataUpdatedAt))
        .map((row) => Number(row.tmdbId)),
    );

    const items = rows.map((row): MovieStar => {
      const tmdbId = Number(row.tmdbId);
      const info = details.get(tmdbId);
      const year = row.releaseYear ?? info?.year;

      return {
        mediaType,
        tmdbId,
        title: row.title || info?.title || 'Unknown',
        year: year ? String(year) : 'Unknown',
        director: row.director || info?.creator || 'Unknown',
        rating: Number(row.rating),
        synopsis: info?.synopsis || 'No synopsis available',
        lastWatched: row.lastWatched,
        posterUrl: info?.posterUrl ?? NO_POSTER,
        sourceUrl: info?.sourceUrl ?? null,
        categories: categories.get(tmdbId) ?? [],
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

  async getMovieDetails(
    channel: Channel,
    mediaType: MediaType,
    tmdbId: number,
  ): Promise<MovieDetailResponse> {
    const [info, stars, users, categories] = await Promise.all([
      this.catalog.getInfo(mediaType, tmdbId),
      this.getStarsByItem(channel.channelId, mediaType, tmdbId),
      this.userService.getAll(),
      this.categoryAverages(channel, mediaType, [tmdbId]),
    ]);

    return {
      mediaType,
      tmdbId,
      title: info?.title || 'Unknown',
      year: info?.year ? String(info.year) : 'Unknown',
      director: info?.creator || 'Unknown',
      rating:
        stars.length > 0
          ? Number(
              (
                stars.reduce((sum, s) => sum + Number(s.score), 0) /
                stars.length
              ).toFixed(1),
            )
          : 0,
      synopsis: info?.synopsis || 'No synopsis available',
      lastWatched:
        stars.length > 0
          ? stars[0].createdAt.toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
            })
          : 'Unknown',
      posterUrl: info?.posterUrl ?? NO_POSTER,
      sourceUrl: info?.sourceUrl ?? null,
      platforms: info?.platforms ?? [],
      genres: info?.genres ?? [],
      earlyAccessYear: info?.earlyAccessYear ?? null,
      categories: categories.get(tmdbId) ?? [],
      stars: stars.map((s) => {
        const user = users.find((u) => u.userId === s.userId);
        return {
          username: user?.username || 'Unknown',
          score: Number(s.score),
          scores: Object.fromEntries(
            (s.scores ?? []).map((row) => [row.categoryKey, Number(row.score)]),
          ),
          createdAt: s.createdAt,
        };
      }),
    };
  }

  // !star: una sola nota por usuario mientras la votación esté abierta
  async submitStar(
    channel: Channel,
    voter: ChatVoter,
    args: string[],
  ): Promise<SubmitStarResponse> {
    const { session, info } = await this.ratingSessionService.requireOpen(
      channel.channelId,
    );
    const categories: ScoreCategory[] = session.categories;

    const parsed = parseScores(args, categories);
    if (!parsed.ok) {
      throw new BadRequestException(
        `Disculpa ${voter.username}, ${parsed.error}`,
      );
    }

    const user = await this.userService.findOrCreate(
      voter.userId,
      voter.username,
    );

    const existingStar = await this.starModel.findOne({
      where: { ...sessionStarsWhere(session), userId: user.userId },
    });
    if (existingStar) {
      throw new BadRequestException(
        `${voter.username} ya ha dado ${Number(existingStar.score)} estrellas a ${mediaLabel(info)}. Solo se permite una valoración por votación; si te equivocaste, usa !apelar.`,
      );
    }

    const { score, scores } = parsed.value;
    await this.sequelize.transaction(async (transaction) => {
      const star = await this.starModel.create(
        {
          userId: user.userId,
          tmdbId: info.id,
          channelId: channel.channelId,
          mediaType: info.mediaType,
          score,
          sessionId: session.id,
        },
        { transaction },
      );
      await this.starScoreModel.bulkCreate(
        Object.entries(scores).map(([categoryKey, value]) => ({
          starId: Number(star.id),
          categoryKey,
          score: value,
        })),
        { transaction },
      );
    });
    // El contenido puntuado queda en el índice de búsqueda (Movies)
    this.catalog.syncMetadataInBackground(info.mediaType, [info.id]);

    const breakdown = formatScores(scores, categories);
    const fullStars = Math.floor(score);
    const hasHalfStar = score % 1 >= 0.5;
    const starsAsEmotes = `${'⭐'.repeat(fullStars)}${hasHalfStar ? '½' : ''}`;

    return {
      message: `${voter.username} ha dado ${starsAsEmotes} (${score}) estrellas a ${mediaLabel(info)}${breakdown ? ` — ${breakdown}` : ''}`,
      stars: score,
    };
  }

  // Promedio de cada categoría por contenido, en el orden de las categorías del canal
  private async categoryAverages(
    channel: Channel,
    mediaType: MediaType,
    tmdbIds: number[],
  ): Promise<Map<number, CategoryAverage[]>> {
    const result = new Map<number, CategoryAverage[]>();
    if (!tmdbIds.length) return result;

    const rows = await this.sequelize.query<{
      tmdbId: number;
      categoryKey: string;
      average: number;
    }>(
      `SELECT s."tmdbId", ss."categoryKey",
              ROUND(AVG(ss."score")::numeric, 1)::float AS "average"
         FROM "Stars" s
         JOIN "StarScores" ss ON ss."starId" = s."id"
        WHERE s."channelId" = :channelId AND s."mediaType" = :mediaType
          AND s."tmdbId" IN (:tmdbIds)
        GROUP BY s."tmdbId", ss."categoryKey"`,
      {
        replacements: { channelId: channel.channelId, mediaType, tmdbIds },
        type: QueryTypes.SELECT,
      },
    );
    if (!rows.length) return result;

    const known = categoryLabels(channel, mediaType);
    const order = new Map(
      known.map((category, index) => [category.key, index]),
    );
    for (const row of rows) {
      const tmdbId = Number(row.tmdbId);
      const list = result.get(tmdbId) ?? [];
      list.push({
        key: row.categoryKey,
        label:
          known.find((c) => c.key === row.categoryKey)?.label ??
          row.categoryKey,
        average: Number(row.average),
      });
      result.set(tmdbId, list);
    }
    for (const list of result.values()) {
      list.sort(
        (a, b) =>
          (order.get(a.key) ?? Infinity) - (order.get(b.key) ?? Infinity),
      );
    }
    return result;
  }
}
