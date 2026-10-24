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
  CurrentMovieService,
  type MovieActionResult,
} from '@/star/current-movie.service';
import { ChannelService } from '@/channel/channel.service';
import type { Channel } from '@/channel/channel.model';
import { extractTmdbId } from '@/utils/url-decoder.utils';
import { buildKcinemaMessage } from '@/channel/channel.settings';

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
    '!setmovie': (channel, tags, args) => this.setMovie(channel, tags, args),
    '!clearmovie': (channel, tags) => this.clearMovie(channel, tags),
    '!kcinema': (channel, tags, args) => this.kcinema(channel, tags, args),
  };

  // channelId → última vez que se respondió a !kcinema
  private readonly kcinemaLastReply = new Map<string, number>();

  constructor(
    private readonly twitchChat: TwitchChatService,
    private readonly recommendationService: RecommendationService,
    private readonly starService: StarService,
    private readonly currentMovieService: CurrentMovieService,
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
    const stars = Number(args[0]);

    if (
      !args[0] ||
      isNaN(stars) ||
      stars < 0.5 ||
      stars > 5 ||
      stars % 0.5 !== 0
    ) {
      await this.twitchChat.say(
        channel.channelUsername,
        `Disculpa ${displayName}, por favor proporciona un número del 0.5 al 5 y sus intermedios.`,
      );
      return;
    }

    await this.reply(
      channel,
      async () =>
        (
          await this.starService.submitStar({
            channelId: channel.channelId,
            userId: Number(tags['user-id']),
            username: displayName,
            stars,
          })
        ).message,
      `Disculpa ${displayName}, hubo un error al enviar tu calificación.`,
    );
  }

  private async setMovie(
    channel: Channel,
    tags: ChatUserstate,
    args: string[],
  ) {
    const displayName = this.displayName(tags);

    if (!args.length) {
      await this.twitchChat.say(
        channel.channelUsername,
        `Disculpa ${displayName}, por favor proporciona la url de tmdb de la película.`,
      );
      return;
    }

    if (!this.isModerator(channel, tags)) {
      await this.twitchChat.say(
        channel.channelUsername,
        `Disculpa ${displayName}, solo el streamer o los mods puede usar este comando.`,
      );
      return;
    }

    // Acepta un TMDB ID o una URL de themoviedb.org
    const tmdbId = /^\d+$/.test(args[0])
      ? Number(args[0])
      : extractTmdbId(args[0]);

    if (!tmdbId) {
      await this.twitchChat.say(
        channel.channelUsername,
        `Disculpa ${displayName}, no pude obtener el TMDB ID de "${args[0]}".`,
      );
      return;
    }

    await this.reply(
      channel,
      () =>
        this.currentMovieService.setCurrentMovie(channel, {
          tmdbId,
          announce: true,
        }),
      `Disculpa ${displayName}, hubo un error al actualizar la película.`,
    );
  }

  private async clearMovie(channel: Channel, tags: ChatUserstate) {
    const displayName = this.displayName(tags);

    if (!this.isModerator(channel, tags)) {
      await this.twitchChat.say(
        channel.channelUsername,
        `Disculpa ${displayName}, solo el streamer o los mods puede usar este comando.`,
      );
      return;
    }

    await this.reply(
      channel,
      () => this.currentMovieService.clearCurrentMovie(channel, true),
      `Disculpa ${displayName}, hubo un error al cerrar la puntuación.`,
    );
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
