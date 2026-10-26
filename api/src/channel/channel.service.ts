import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Channel } from './channel.model';
import type {
  ChannelProfile,
  UpdateChannelBody,
  VerifiedIdentity,
} from './channel.dto';
import {
  CATEGORY_KEY_PATTERN,
  ChannelCommands,
  ChannelSettings,
  DEFAULT_KCINEMA_MESSAGE,
  MAX_CATEGORIES,
  MAX_CATEGORY_LABEL_LENGTH,
  MAX_KCINEMA_MESSAGE_LENGTH,
  MAX_SECTION_SIZE,
  MAX_VOTING_MINUTES,
  MEDIA_TYPES,
  MIN_SECTION_SIZE,
  MIN_VOTING_MINUTES,
  type MediaType,
  type RatingCategory,
  type RatingSettings,
  SECTION_KINDS,
  defaultChannelCommands,
  defaultChannelSettings,
  resolveSettings,
} from './channel.settings';
import { TwitchChatService } from '@/twitch/twitch-chat.service';

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const MAX_HIDDEN_ITEMS = 500;

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(
    @InjectModel(Channel)
    private readonly channelModel: typeof Channel,
    private readonly twitchChat: TwitchChatService,
  ) {}

  static normalizeUsername(channelUsername: string) {
    return channelUsername.trim().replace(/^#/, '').toLowerCase();
  }

  toProfile(channel: Channel): ChannelProfile {
    return {
      channelId: channel.channelId,
      channelUsername: channel.channelUsername,
      platform: channel.platform,
      displayName: channel.displayName,
      description: channel.description,
      accentColor: channel.accentColor,
      settings: resolveSettings(channel.settings),
    };
  }

  async findById(channelId: string) {
    return this.channelModel.findByPk(channelId);
  }

  async getByUsername(channelUsername: string) {
    const channel = await this.channelModel.findOne({
      where: {
        channelUsername: ChannelService.normalizeUsername(channelUsername),
      },
    });

    if (!channel) {
      throw new NotFoundException(
        `El canal ${channelUsername} no está registrado.`,
      );
    }

    return channel;
  }

  // Alta o actualización del canal tras el login con Twitch (datos ya verificados por OAuth)
  async upsertFromTwitch(identity: VerifiedIdentity): Promise<Channel> {
    const channelUsername = ChannelService.normalizeUsername(
      identity.channelUsername,
    );
    const channelId = identity.channelId;

    const byName = await this.channelModel.findOne({
      where: { channelUsername },
    });
    if (byName && byName.channelId !== channelId) {
      throw new ConflictException(
        `El canal ${channelUsername} ya está registrado con otro ID de Twitch.`,
      );
    }

    const existing = await this.findById(channelId);

    if (existing) {
      // Mismo ID con otro nombre: el streamer cambió su nombre en Twitch
      if (existing.channelUsername !== channelUsername) {
        const previousUsername = existing.channelUsername;
        if (existing.displayName === previousUsername) {
          existing.displayName = channelUsername;
        }
        existing.channelUsername = channelUsername;
        await existing.save();

        this.logger.log(
          `Canal ${channelId} renombrado: ${previousUsername} → ${channelUsername}`,
        );
        await this.twitchChat.part(previousUsername);
        await this.twitchChat.join(channelUsername);
      }
      return existing;
    }

    const channel = await this.channelModel.create({
      channelId,
      channelUsername,
      displayName: channelUsername,
      settings: defaultChannelSettings(),
    });

    this.logger.log(`Canal registrado: ${channelUsername} (${channelId})`);
    await this.twitchChat.join(channelUsername);
    return channel;
  }

  async update(channel: Channel, body: UpdateChannelBody): Promise<Channel> {
    if (body.displayName !== undefined) {
      const displayName = String(body.displayName).trim();
      if (displayName.length < 1 || displayName.length > 60) {
        throw new BadRequestException(
          'El título debe tener entre 1 y 60 caracteres.',
        );
      }
      channel.displayName = displayName;
    }

    if (body.description !== undefined) {
      const description = String(body.description).trim();
      if (description.length > 300) {
        throw new BadRequestException(
          'La descripción no puede superar los 300 caracteres.',
        );
      }
      channel.description = description;
    }

    if (body.accentColor !== undefined) {
      if (!COLOR_PATTERN.test(String(body.accentColor))) {
        throw new BadRequestException(
          'El color debe tener el formato #rrggbb.',
        );
      }
      channel.accentColor = String(body.accentColor).toLowerCase();
    }

    if (body.settings !== undefined) {
      channel.settings = this.validateSettings(body.settings, channel.settings);
    }

    await channel.save();
    return channel;
  }

  // Cambia el mensaje de !kcinema (desde el chat). null vuelve al mensaje por defecto
  async setKcinemaMessage(channel: Channel, message: string | null) {
    channel.settings = {
      ...channel.settings,
      commands: this.validateCommands({
        ...channel.settings.commands,
        kcinema: { message: message ?? DEFAULT_KCINEMA_MESSAGE },
      }),
    };
    channel.changed('settings', true);
    await channel.save();
    return channel.settings.commands!.kcinema.message;
  }

  async listByPlatform(platform: Channel['platform']) {
    return this.channelModel.findAll({ where: { platform } });
  }

  private validateSettings(
    settings: ChannelSettings,
    previous: ChannelSettings,
  ): ChannelSettings {
    if (!settings || !Array.isArray(settings.sections)) {
      throw new BadRequestException('La configuración no es válida.');
    }

    const sections = settings.sections.map((section) => {
      const title = String(section?.title ?? '').trim();
      const size = Number(section?.size);

      if (
        typeof section?.id !== 'string' ||
        !section.id ||
        section.id.length > 20 ||
        !SECTION_KINDS.includes(section.kind) ||
        !MEDIA_TYPES.includes(section.mediaType)
      ) {
        throw new BadRequestException('Hay una sección no válida.');
      }
      if (title.length < 1 || title.length > 40) {
        throw new BadRequestException(
          'El título de cada sección debe tener entre 1 y 40 caracteres.',
        );
      }
      if (
        !Number.isInteger(size) ||
        size < MIN_SECTION_SIZE ||
        size > MAX_SECTION_SIZE
      ) {
        throw new BadRequestException(
          `El tamaño de cada sección debe estar entre ${MIN_SECTION_SIZE} y ${MAX_SECTION_SIZE}.`,
        );
      }

      return {
        id: section.id,
        kind: section.kind,
        mediaType: section.mediaType,
        title,
        size,
      };
    });

    const hidden = Array.isArray(settings.hidden) ? settings.hidden : [];
    if (hidden.length > MAX_HIDDEN_ITEMS) {
      throw new BadRequestException('Hay demasiadas películas ocultas.');
    }

    const resolvedPrevious = resolveSettings(previous);

    return {
      sections,
      commands: this.validateCommands(settings.commands),
      rating: this.validateRating(settings.rating, resolvedPrevious.rating),
      voting: settings.voting
        ? {
            defaultMinutes: this.validateMinutes(
              settings.voting.defaultMinutes,
            ),
          }
        : resolvedPrevious.voting,
      appeals: settings.appeals
        ? { enabled: settings.appeals.enabled === true }
        : resolvedPrevious.appeals,
      hidden: hidden.map((item) => {
        const tmdbId = Number(item?.tmdbId);
        if (
          !MEDIA_TYPES.includes(item?.mediaType) ||
          !Number.isInteger(tmdbId) ||
          tmdbId <= 0
        ) {
          throw new BadRequestException('Hay un elemento oculto no válido.');
        }
        return { mediaType: item.mediaType, tmdbId };
      }),
    };
  }

  private validateMinutes(value: unknown) {
    const minutes = Number(value);
    if (
      !Number.isInteger(minutes) ||
      minutes < MIN_VOTING_MINUTES ||
      minutes > MAX_VOTING_MINUTES
    ) {
      throw new BadRequestException(
        `La duración de la votación debe estar entre ${MIN_VOTING_MINUTES} y ${MAX_VOTING_MINUTES} minutos.`,
      );
    }
    return minutes;
  }

  // Las categorías que ya existían nunca desaparecen: si no vienen, quedan archivadas
  // (los votos antiguos las siguen usando)
  private validateRating(
    rating: RatingSettings | undefined,
    previous: RatingSettings,
  ): RatingSettings {
    if (!rating?.categories) return previous;

    const categories = Object.fromEntries(
      MEDIA_TYPES.map((mediaType): [MediaType, RatingCategory[]] => {
        const raw = rating.categories[mediaType];
        if (raw !== undefined && !Array.isArray(raw)) {
          throw new BadRequestException('Las categorías no son válidas.');
        }

        const list = (raw ?? previous.categories[mediaType]).map(
          (category): RatingCategory => {
            const key = String(category?.key ?? '');
            const label = String(category?.label ?? '')
              .replace(/\s+/g, ' ')
              .trim();
            if (!CATEGORY_KEY_PATTERN.test(key)) {
              throw new BadRequestException(
                `La categoría "${label || key}" no tiene una clave válida.`,
              );
            }
            if (label.length < 1 || label.length > MAX_CATEGORY_LABEL_LENGTH) {
              throw new BadRequestException(
                `El nombre de cada categoría debe tener entre 1 y ${MAX_CATEGORY_LABEL_LENGTH} caracteres.`,
              );
            }
            return category.archived
              ? { key, label, archived: true }
              : { key, label };
          },
        );

        const keys = new Set(list.map((category) => category.key));
        if (keys.size !== list.length) {
          throw new BadRequestException('Hay categorías repetidas.');
        }
        for (const old of previous.categories[mediaType]) {
          if (!keys.has(old.key)) list.push({ ...old, archived: true });
        }
        if (
          list.filter((category) => !category.archived).length > MAX_CATEGORIES
        ) {
          throw new BadRequestException(
            `Puede haber como mucho ${MAX_CATEGORIES} categorías activas.`,
          );
        }
        return [mediaType, list];
      }),
    ) as Record<MediaType, RatingCategory[]>;

    return { categories };
  }

  private validateCommands(
    commands: Partial<ChannelCommands> | undefined,
  ): ChannelCommands {
    const raw = commands?.kcinema?.message;
    if (raw === undefined) return defaultChannelCommands();

    // Un solo renglón: el chat de Twitch no admite saltos de línea
    const message = String(raw).replace(/\s+/g, ' ').trim();
    if (message.length < 1 || message.length > MAX_KCINEMA_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `El mensaje de !kcinema debe tener entre 1 y ${MAX_KCINEMA_MESSAGE_LENGTH} caracteres.`,
      );
    }
    return { kcinema: { message } };
  }
}
