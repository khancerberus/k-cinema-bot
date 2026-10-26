import {
  HttpException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChatUserstate } from 'tmi.js';
import { TwitchChatService } from './twitch-chat.service';
import { RecommendationService } from '@/recommendation/recommendation.service';
import { StarService } from '@/star/star.service';
import {
  RatingSessionService,
  type MovieActionResult,
} from '@/star/rating-session.service';
import { AppealService } from '@/star/appeal.service';
import { ChannelService } from '@/channel/channel.service';
import type { Channel } from '@/channel/channel.model';
import { CatalogService } from '@/movie/catalog.service';
import {
  buildKcinemaMessage,
  type MediaType,
} from '@/channel/channel.settings';
import { parseItemReference, parseKCommand } from '@/star/star-input';

const K_USAGE =
  'Uso: !k movie|game <ID, URL o nombre> [15m] · !k close · !k extend 5m · !k aprobar|rechazar @usuario';

// Tiempo mínimo entre respuestas a !kcinema en un mismo canal (evita spam)
const KCINEMA_COOLDOWN_MS = 30_000;

type CommandHandler = (
  channel: Channel,
  tags: ChatUserstate,
  args: string[],
) => Promise<void>;

// !peli (Jellyfin) se queda en el servicio bot/
@Injectable()
export class TwitchCommandsService implements OnModuleInit {
  private readonly logger = new Logger(TwitchCommandsService.name);

  private readonly commands: Record<string, CommandHandler> = {
    '!rec': (channel, tags, args) => this.recommend(channel, tags, args),
    '!star': (channel, tags, args) => this.submitStar(channel, tags, args),
    '!apelar': (channel, tags, args) => this.appeal(channel, tags, args),
    '!k': (channel, tags, args) => this.k(channel, tags, args),
    // Alias anteriores a !k
    '!setmovie': (channel, tags, args) =>
      this.k(channel, tags, ['movie', ...args]),
    '!clearmovie': (channel, tags) => this.k(channel, tags, ['close']),
    '!kcinema': (channel, tags, args) => this.kcinema(channel, tags, args),
  };

  // channelId → última vez que se respondió a !kcinema
  private readonly kcinemaLastReply = new Map<string, number>();

  constructor(
    private readonly twitchChat: TwitchChatService,
    private readonly recommendationService: RecommendationService,
    private readonly starService: StarService,
    private readonly ratingSessionService: RatingSessionService,
    private readonly appealService: AppealService,
    private readonly catalog: CatalogService,
    private readonly channelService: ChannelService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.twitchChat.onMessage(async (_ircChannel, tags, message) => {
      const [command, ...args] = message.trim().split(' ');
      const handler = this.commands[command];
      if (!handler) return;

      // room-id es el ID de Twitch del canal: no cambia aunque el canal se renombre
      const channelId = tags['room-id'];
      const channel = channelId
        ? await this.channelService.findById(channelId)
        : null;
      if (!channel) return; // Canal no registrado en K-Cinema

      await handler(channel, tags, args);
    });
  }

  private displayName(tags: ChatUserstate) {
    return tags['display-name'] || tags.username || 'usuario';
  }

  private isModerator(channel: Channel, tags: ChatUserstate) {
    return tags['user-id'] === channel.channelId || Boolean(tags.mod);
  }

  // Envía al chat la respuesta del servicio; si lanza una HttpException se envía su mensaje.
  // Si el servicio ya publicó su propio aviso (announced), no se responde aparte.
  private async reply(
    channel: Channel,
    action: () => Promise<string | MovieActionResult>,
    fallbackMessage: string,
  ) {
    let message: string;

    try {
      const result = await action();
      if (typeof result !== 'string' && result.announced) {
        return;
      }
      message = typeof result === 'string' ? result : result.message;
    } catch (error) {
      if (error instanceof HttpException && error.message.trim()) {
        message = error.message;
      } else {
        this.logger.error(error);
        message = fallbackMessage;
      }
    }

    await this.twitchChat.say(channel.channelUsername, message);
  }

  private async recommend(
    channel: Channel,
    tags: ChatUserstate,
    args: string[],
  ) {
    const displayName = this.displayName(tags);

    if (!args.length) {
      await this.twitchChat.say(
        channel.channelUsername,
        `@${displayName}, Uso: !rec <url de la pelicula en themoviedb.org>`,
      );
      return;
    }

    await this.reply(
      channel,
      () =>
        this.recommendationService.recommend({
          userId: tags['user-id'] ?? '',
          username: displayName,
          movieOrTmdbId: args.join(' '),
        }),
      `Disculpa ${displayName}, hubo un error al procesar tu recomendación.`,
    );
  }

  private async submitStar(
    channel: Channel,
    tags: ChatUserstate,
    args: string[],
  ) {
    const displayName = this.displayName(tags);

    // La validación depende de las categorías de la votación abierta: la hace el servicio
    await this.reply(
      channel,
      async () =>
        (
          await this.starService.submitStar(
            channel,
            { userId: Number(tags['user-id']), username: displayName },
            args,
          )
        ).message,
      `Disculpa ${displayName}, hubo un error al enviar tu calificación.`,
    );
  }

  private async appeal(channel: Channel, tags: ChatUserstate, args: string[]) {
    const displayName = this.displayName(tags);

    await this.reply(
      channel,
      () =>
        this.appealService.request(
          channel,
          { userId: Number(tags['user-id']), username: displayName },
          args,
        ),
      `Disculpa ${displayName}, hubo un error al registrar tu apelación.`,
    );
  }

  // !k: comandos del streamer y los mods para la votación
  private async k(channel: Channel, tags: ChatUserstate, args: string[]) {
    const displayName = this.displayName(tags);

    if (!this.isModerator(channel, tags)) {
      await this.twitchChat.say(
        channel.channelUsername,
        `Disculpa ${displayName}, solo el streamer o los mods pueden usar este comando.`,
      );
      return;
    }

    const command = parseKCommand(args);
    switch (command.action) {
      case 'help':
        await this.twitchChat.say(
          channel.channelUsername,
          `@${displayName}, ${K_USAGE}`,
        );
        return;

      case 'open':
        await this.reply(
          channel,
          () =>
            this.openContent(
              channel,
              command.mediaType,
              command.query,
              command.minutes,
            ),
          `Disculpa ${displayName}, hubo un error al activar el contenido.`,
        );
        return;

      case 'close':
        await this.reply(
          channel,
          () => this.ratingSessionService.close(channel, true),
          `Disculpa ${displayName}, hubo un error al cerrar la puntuación.`,
        );
        return;

      case 'extend':
        await this.reply(
          channel,
          () => this.ratingSessionService.extend(channel, command.minutes),
          `Disculpa ${displayName}, no se pudo alargar la votación.`,
        );
        return;

      case 'approve':
      case 'reject':
        await this.reply(
          channel,
          () =>
            this.appealService.resolve(
              channel,
              command.username,
              command.action === 'approve',
              displayName,
            ),
          `Disculpa ${displayName}, no se pudo resolver la apelación.`,
        );
        return;
    }
  }

  private async openContent(
    channel: Channel,
    mediaType: MediaType,
    query: string,
    minutes?: number,
  ): Promise<string | MovieActionResult> {
    const reference = parseItemReference(mediaType, query);
    const info = reference
      ? await this.catalog.resolve(mediaType, reference)
      : null;
    if (!info) {
      const kind = mediaType === 'game' ? 'ningún juego' : 'ninguna película';
      return `No encontré ${kind} con "${query}". Prueba con el ID o la URL de ${mediaType === 'game' ? 'IGDB' : 'TMDB'}.`;
    }
    return this.ratingSessionService.open(channel, info, {
      minutes,
      announce: true,
    });
  }

  // !kcinema → enlace al perfil del canal en la web
  // !kcinema set <mensaje> / !kcinema reset → solo streamer o mods
  private async kcinema(channel: Channel, tags: ChatUserstate, args: string[]) {
    const displayName = this.displayName(tags);
    const action = args[0]?.toLowerCase();

    if (action === 'set' || action === 'reset') {
      if (!this.isModerator(channel, tags)) {
        await this.twitchChat.say(
          channel.channelUsername,
          `Disculpa ${displayName}, solo el streamer o los mods pueden cambiar este mensaje.`,
        );
        return;
      }

      const message = action === 'set' ? args.slice(1).join(' ').trim() : null;
      if (action === 'set' && !message) {
        await this.twitchChat.say(
          channel.channelUsername,
          `@${displayName}, Uso: !kcinema set <mensaje>. Usa {url} donde quieras el enlace al perfil.`,
        );
        return;
      }

      await this.reply(
        channel,
        async () => {
          const saved = await this.channelService.setKcinemaMessage(
            channel,
            message,
          );
          return `@${displayName}, mensaje de !kcinema actualizado: "${saved}"`;
        },
        `Disculpa ${displayName}, no se pudo guardar el mensaje.`,
      );
      return;
    }

    const now = Date.now();
    const lastReply = this.kcinemaLastReply.get(channel.channelId) ?? 0;
    if (now - lastReply < KCINEMA_COOLDOWN_MS) return;
    this.kcinemaLastReply.set(channel.channelId, now);

    const webUrl = (this.config.get<string>('WEB_URL') ?? '').replace(
      /\/+$/,
      '',
    );
    await this.twitchChat.say(
      channel.channelUsername,
      buildKcinemaMessage(
        channel.settings,
        `${webUrl}/${channel.channelUsername}`,
      ),
    );
  }
}
