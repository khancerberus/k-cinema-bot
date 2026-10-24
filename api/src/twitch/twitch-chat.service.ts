import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import tmi from 'tmi.js';
import { Channel } from '@/channel/channel.model';

const MAX_CHAT_MESSAGE_LENGTH = 450;

export type ChatMessageHandler = (
  channel: string,
  tags: tmi.ChatUserstate,
  message: string,
) => void | Promise<void>;

const toIrcChannel = (channel: string) =>
  channel.startsWith('#') ? channel.toLowerCase() : `#${channel.toLowerCase()}`;

@Injectable()
export class TwitchChatService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(TwitchChatService.name);
  private readonly handlers: ChatMessageHandler[] = [];
  private client: tmi.Client | null = null;

  constructor(
    @InjectModel(Channel)
    private readonly channelModel: typeof Channel,
  ) {}

  // Se conecta en onApplicationBootstrap para que la migración de la base ya se haya aplicado
  async onApplicationBootstrap() {
    // Permite desactivar el bot en desarrollo para no tener dos instancias respondiendo
    if (process.env.TWITCH_BOT_ENABLED === 'false') {
      this.logger.warn('Bot de Twitch desactivado (TWITCH_BOT_ENABLED=false)');
      return;
    }

    if (!process.env.BOT_USERNAME || !process.env.BOT_TOKEN) {
      this.logger.warn(
        'Faltan BOT_USERNAME o BOT_TOKEN: el bot de Twitch no se conectará',
      );
      return;
    }

    const channels = await this.channelModel.findAll({
      attributes: ['channelUsername'],
      where: { platform: 'twitch' },
    });

    this.client = new tmi.Client({
      identity: {
        username: process.env.BOT_USERNAME,
        password: process.env.BOT_TOKEN,
      },
      channels: channels.map((channel) => channel.channelUsername),
    });

    this.client.on('message', (channel, tags, message, self) => {
      if (self) return;
      for (const handler of this.handlers) {
        Promise.resolve(handler(channel, tags, message)).catch((error) =>
          this.logger.error('Error procesando mensaje del chat', error),
        );
      }
    });

    // No bloqueamos el arranque de la API si Twitch no responde
    this.client
      .connect()
      .then(() =>
        this.logger.log(
          `Conectado al chat de Twitch (${channels.length} canales)`,
        ),
      )
      .catch((error) =>
        this.logger.error('No se pudo conectar al chat de Twitch', error),
      );
  }

  async onModuleDestroy() {
    await this.client?.disconnect().catch(() => undefined);
  }

  onMessage(handler: ChatMessageHandler) {
    this.handlers.push(handler);
  }

  // Entra al chat de un canal recién registrado o renombrado
  async join(channel: string) {
    if (!this.isConnected()) return;
    await this.client!.join(toIrcChannel(channel)).catch((error) =>
      this.logger.warn(`No se pudo entrar al chat de ${channel}: ${error}`),
    );
  }

  async part(channel: string) {
    if (!this.isConnected()) return;
    await this.client!.part(toIrcChannel(channel)).catch(() => undefined);
  }

  // Único punto de envío: si se cambia de librería (p. ej. ComfyJS), solo cambia esto
  async say(channel: string, message: string) {
    if (!this.isConnected()) {
      throw new Error('El bot de Twitch no está conectado');
    }

    const clampedMessage =
      message.length <= MAX_CHAT_MESSAGE_LENGTH
        ? message
        : `${message.slice(0, MAX_CHAT_MESSAGE_LENGTH - 3)}...`;

    await this.client!.say(toIrcChannel(channel), clampedMessage);
  }

  private isConnected() {
    return this.client?.readyState() === 'OPEN';
  }
}
