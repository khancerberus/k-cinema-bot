import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes, type Transaction, type WhereOptions } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { CurrentMovie } from './current-movie.model';
import { RatingSession } from './rating-session.model';
import { Star } from './star.model';
import { TwitchChatService } from '@/twitch/twitch-chat.service';
import { ChannelService } from '@/channel/channel.service';
import type { Channel } from '@/channel/channel.model';
import {
  MAX_VOTING_MINUTES,
  MIN_VOTING_MINUTES,
  activeCategories,
  resolveSettings,
  type MediaType,
} from '@/channel/channel.settings';
import {
  CatalogService,
  mediaLabel,
  type MediaInfo,
} from '@/movie/catalog.service';
import { roundScore, scoreFormatHint } from './star-input';

export interface MovieActionResult {
  // Texto para la web, o para responder en el chat si no se publicó el aviso
  message: string;
  // true si el aviso ya se publicó en el chat
  announced: boolean;
}

export interface OpenSessionOptions {
  minutes?: number;
  announce?: boolean;
}

export interface OpenSession {
  session: RatingSession;
  info: MediaInfo;
}

// Lo que ve la web del contenido activo
export interface CurrentItemResponse {
  sessionId: number;
  mediaType: MediaType;
  // Mismo valor que itemId: la web antigua lo leía así
  tmdbId: number;
  itemId: number;
  title: string;
  releaseYear: string;
  posterUrl: string | null;
  categories: RatingSession['categories'];
  openedAt: Date;
  closesAt: Date | null;
  votes: number;
}

const AUTO_CLOSE_INTERVAL_MS = 30_000;

const MEDIA_EMOJI: Record<MediaType, string> = { movie: '🎬', game: '🎮' };
const MEDIA_EMOJI_SECONDARY: Record<MediaType, string> = {
  movie: '🍿',
  game: '👾',
};
const MEDIA_NAME: Record<MediaType, string> = {
  movie: 'la película',
  game: 'el juego',
};

const startOfToday = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

// Votos de una ventana: mismo canal y contenido, desde que se abrió.
// Así cuentan también los votos de antes de existir sessionId (ventanas migradas de CurrentMovies).
export const sessionStarsWhere = (
  session: RatingSession,
): WhereOptions<Star> => ({
  channelId: session.channelId,
  mediaType: session.mediaType,
  tmdbId: session.itemId,
  createdAt: {
    [Op.gte]: session.openedAt,
    ...(session.closedAt ? { [Op.lte]: session.closedAt } : {}),
  },
});

@Injectable()
export class RatingSessionService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RatingSessionService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectModel(RatingSession)
    private readonly sessionModel: typeof RatingSession,
    @InjectModel(CurrentMovie)
    private readonly currentMovieModel: typeof CurrentMovie,
    @InjectModel(Star)
    private readonly starModel: typeof Star,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly catalog: CatalogService,
    private readonly twitchChat: TwitchChatService,
    private readonly channelService: ChannelService,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.adoptLegacyCurrentMovies();
    } catch (error) {
      this.logger.error(
        'No se pudieron migrar las películas activas',
        error as Error,
      );
    }
    // Las ventanas vencidas se cierran desde aquí: si la API se reinicia, se cierran al volver
    this.timer = setInterval(
      () => void this.closeExpired(),
      AUTO_CLOSE_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async open(
    channel: Channel,
    info: MediaInfo,
    options: OpenSessionOptions = {},
  ): Promise<MovieActionResult> {
    const settings = resolveSettings(channel.settings);
    const minutes = options.minutes ?? settings.voting.defaultMinutes;
    if (
      !Number.isInteger(minutes) ||
      minutes < MIN_VOTING_MINUTES ||
      minutes > MAX_VOTING_MINUTES
    ) {
      throw new BadRequestException(
        `La votación debe durar entre ${MIN_VOTING_MINUTES} y ${MAX_VOTING_MINUTES} minutos.`,
      );
    }

    const previous = await this.getOpenSession(channel.channelId);
    const now = new Date();
    const categories = activeCategories(channel.settings, info.mediaType);

    await this.sequelize.transaction(async (transaction) => {
      // Cambiar de contenido cierra la ventana anterior (sin anuncio, como al cambiar de película)
      if (previous) {
        await previous.update({ closedAt: now }, { transaction });
      }
      await this.sessionModel.create(
        {
          channelId: channel.channelId,
          mediaType: info.mediaType,
          itemId: info.id,
          categories,
          openedAt: now,
          closesAt: new Date(now.getTime() + minutes * 60_000),
        },
        { transaction },
      );
      await this.syncCurrentMovie(channel, info, transaction);
    });

    this.catalog.syncMetadataInBackground(info.mediaType, [info.id]);

    const status = previous ? 'actualizado' : 'establecido';
    const message = `Se ha ${status} ${MEDIA_NAME[info.mediaType]} ${mediaLabel(info)} (ID ${info.id}). Votación abierta ${minutes} minutos.`;
    if (!options.announce) return { message, announced: false };

    const chatMessage = `${MEDIA_EMOJI[info.mediaType]} ¡Ya se puede puntuar ${mediaLabel(info)}! Tienen ${minutes} minutos: usen !star con ${scoreFormatHint(categories)} ⭐`;
    return this.announce(channel.channelUsername, chatMessage, message);
  }

  async getOpenSession(channelId: string) {
    return this.sessionModel.findOne({
      where: { channelId, closedAt: null },
    });
  }

  // Ventana abierta con los datos del contenido; NotFound si no hay ninguna
  async requireOpen(channelId: string): Promise<OpenSession> {
    const session = await this.getOpenSession(channelId);
    if (!session) {
      throw new NotFoundException(
        'No hay ninguna votación abierta en este momento.',
      );
    }
    const info = await this.catalog.getInfo(session.mediaType, session.itemId);
    if (!info) {
      throw new NotFoundException(
        `No se encontró el contenido con ID ${session.itemId}.`,
      );
    }
    return { session, info };
  }

  async getCurrent(channelId: string): Promise<CurrentItemResponse> {
    const { session, info } = await this.requireOpen(channelId);
    const votes = await this.starModel.count({
      where: sessionStarsWhere(session),
    });
    return {
      sessionId: Number(session.id),
      mediaType: session.mediaType,
      tmdbId: session.itemId,
      itemId: session.itemId,
      title: info.title,
      releaseYear: String(info.year ?? '?'),
      posterUrl: info.posterUrl,
      categories: session.categories,
      openedAt: session.openedAt,
      closesAt: session.closesAt,
      votes,
    };
  }

  async extend(channel: Channel, minutes: number): Promise<string> {
    const session = await this.getOpenSession(channel.channelId);
    if (!session) {
      throw new NotFoundException('No hay ninguna votación abierta.');
    }
    const base = Math.max(
      Date.now(),
      session.closesAt?.getTime() ?? Date.now(),
    );
    const closesAt = new Date(base + minutes * 60_000);
    if (
      closesAt.getTime() - session.openedAt.getTime() >
      MAX_VOTING_MINUTES * 60_000
    ) {
      throw new BadRequestException(
        `Una votación no puede durar más de ${MAX_VOTING_MINUTES} minutos.`,
      );
    }
    await session.update({ closesAt });
    const remaining = Math.round((closesAt.getTime() - Date.now()) / 60_000);
    return `⏱️ Votación alargada: quedan ${remaining} minutos para usar !star.`;
  }

  // Cierra la votación y resume los votos (global y por categoría)
  async close(channel: Channel, announce = false): Promise<MovieActionResult> {
    const session = await this.getOpenSession(channel.channelId);
    if (!session) {
      return {
        message: 'No hay ninguna votación abierta en este momento.',
        announced: false,
      };
    }
    return this.closeSession(channel, session, announce);
  }

  private async closeSession(
    channel: Pick<Channel, 'channelId' | 'channelUsername'>,
    session: RatingSession,
    announce: boolean,
  ): Promise<MovieActionResult> {
    const closedAt = new Date();
    // Solo cierra quien llega primero (cierre manual y automático a la vez)
    const [updated] = await this.sessionModel.update(
      { closedAt },
      { where: { id: session.id, closedAt: null } },
    );
    if (!updated) {
      return { message: 'La votación ya estaba cerrada.', announced: false };
    }
    session.closedAt = closedAt;
    await this.currentMovieModel.destroy({
      where: { channelId: channel.channelId },
    });

    const info = await this.catalog.getInfo(session.mediaType, session.itemId);
    const label = info ? mediaLabel(info) : `ID ${session.itemId}`;
    const summary = await this.summarize(session);
    const votesLabel = `${summary.votes} ${summary.votes === 1 ? 'voto' : 'votos'}`;
    const breakdown = summary.categories.length
      ? ` — ${summary.categories.map((c) => `${c.label} ${c.average}`).join(' · ')}`
      : '';

    const message = summary.votes
      ? `Puntuación de ${label} cerrada: ${votesLabel}, promedio ${summary.average}★${breakdown}.`
      : `Puntuación de ${label} cerrada sin votos.`;

    if (!announce) return { message, announced: false };

    const emoji = MEDIA_EMOJI[session.mediaType];
    const secondaryEmoji = MEDIA_EMOJI_SECONDARY[session.mediaType];
    const chatMessage = summary.votes
      ? `${emoji} ¡Se cerró la puntuación de ${label}! ${votesLabel} con un promedio de ${summary.average}★${breakdown} (nota más alta: ${summary.highest}★). ¡Gracias por votar! ${secondaryEmoji} Pueden ver el ranking en la web.`
      : `${emoji} Se cerró la puntuación de ${label}, pero nadie votó 😢 ¡A la próxima!`;

    return this.announce(channel.channelUsername, chatMessage, message);
  }

  private async summarize(session: RatingSession) {
    const stars = await this.starModel.findAll({
      attributes: ['id', 'score'],
      where: sessionStarsWhere(session),
    });
    const scores = stars.map((star) => Number(star.score));
    const votes = scores.length;
    const average = votes
      ? roundScore(scores.reduce((sum, s) => sum + s, 0) / votes)
      : 0;

    const categoryRows =
      votes && session.categories.length
        ? await this.sequelize.query<{ categoryKey: string; average: number }>(
            `SELECT "categoryKey", ROUND(AVG("score")::numeric, 1)::float AS "average"
             FROM "StarScores"
            WHERE "starId" IN (:starIds)
            GROUP BY "categoryKey"`,
            {
              replacements: { starIds: stars.map((star) => Number(star.id)) },
              type: QueryTypes.SELECT,
            },
          )
        : [];
    const averages = new Map(
      categoryRows.map((row) => [row.categoryKey, row.average]),
    );

    return {
      votes,
      average,
      highest: votes ? Math.max(...scores) : 0,
      categories: session.categories
        .filter((category) => averages.has(category.key))
        .map((category) => ({
          label: category.label,
          average: averages.get(category.key)!,
        })),
    };
  }

  private async closeExpired() {
    try {
      const expired = await this.sessionModel.findAll({
        where: { closedAt: null, closesAt: { [Op.lte]: new Date() } },
      });
      for (const session of expired) {
        const channel = await this.channelService.findById(session.channelId);
        if (!channel) continue;
        await this.closeSession(channel, session, true);
      }
    } catch (error) {
      this.logger.error('Error cerrando votaciones vencidas', error as Error);
    }
  }

  // CurrentMovies se mantiene para que la estructura antigua siga reflejando el contenido activo
  private async syncCurrentMovie(
    channel: Pick<Channel, 'channelId' | 'channelUsername'>,
    info: MediaInfo,
    transaction: Transaction,
  ) {
    const existing = await this.currentMovieModel.findOne({
      where: { channelId: channel.channelId },
      transaction,
    });
    if (existing) {
      existing.tmdbId = info.id;
      existing.mediaType = info.mediaType;
      await existing.save({ transaction });
    } else {
      await this.currentMovieModel.create(
        {
          channelUsername: channel.channelUsername,
          channelId: channel.channelId,
          tmdbId: info.id,
          mediaType: info.mediaType,
        },
        { transaction },
      );
    }
  }

  // Películas que ya estaban activas antes de existir las ventanas: se convierten en una
  // ventana sin límite de tiempo (se cierra con !k close). openedAt = hoy a las 00:00 para
  // respetar los votos ya dados hoy (antes se permitía uno por día).
  private async adoptLegacyCurrentMovies() {
    const legacy = await this.currentMovieModel.findAll({
      where: { channelId: { [Op.ne]: null } },
    });
    for (const current of legacy) {
      const open = await this.getOpenSession(current.channelId);
      if (open) continue;
      await this.sessionModel.create({
        channelId: current.channelId,
        mediaType: current.mediaType,
        itemId: current.tmdbId,
        categories: [],
        openedAt: startOfToday(),
        closesAt: null,
      });
      this.logger.log(
        `Votación abierta sin límite para ${current.mediaType} ${current.tmdbId} (canal ${current.channelId})`,
      );
    }
  }

  // Si el aviso falla, la acción ya está hecha igualmente
  private async announce(
    channelUsername: string,
    chatMessage: string,
    message: string,
  ): Promise<MovieActionResult> {
    try {
      await this.twitchChat.say(channelUsername, chatMessage);
      return { message, announced: true };
    } catch (error) {
      this.logger.warn(
        `No se pudo avisar en el chat: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        message: `${message} (no se pudo avisar en el chat)`,
        announced: false,
      };
    }
  }
}
