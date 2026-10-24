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
  LoginBody,
  UpdateChannelBody,
} from './channel.dto';
import {
  ChannelSettings,
  MAX_SECTION_SIZE,
  MEDIA_TYPES,
  MIN_SECTION_SIZE,
  SECTION_KINDS,
  defaultChannelSettings,
} from './channel.settings';
import { TwitchChatService } from '@/twitch/twitch-chat.service';

const USERNAME_PATTERN = /^[a-z0-9_]{2,25}$/;
const CHANNEL_ID_PATTERN = /^\d{1,20}$/;
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
      settings: channel.settings,
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

  // Login provisional: el streamer escribe su nombre y su ID de Twitch.
  // TODO: reemplazar por OAuth de Twitch/Kick, que entrega ambos datos verificados
  async login(body: LoginBody): Promise<Channel> {
    const channelUsername = ChannelService.normalizeUsername(
      body.channelUsername ?? '',
    );
    const channelId = String(body.channelId ?? '').trim();

    if (!USERNAME_PATTERN.test(channelUsername)) {
      throw new BadRequestException('El nombre del canal no es válido.');
    }
    if (!CHANNEL_ID_PATTERN.test(channelId)) {
      throw new BadRequestException(
        'El ID de Twitch debe ser numérico (por ejemplo 123456789).',
      );
    }

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
      channel.settings = this.validateSettings(body.settings);
    }

    await channel.save();
    return channel;
  }

  async listByPlatform(platform: Channel['platform']) {
    return this.channelModel.findAll({ where: { platform } });
  }

  private validateSettings(settings: ChannelSettings): ChannelSettings {
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

    return {
      sections,
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
}
