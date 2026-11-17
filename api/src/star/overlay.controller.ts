import {
  Controller,
  HttpCode,
  type MessageEvent,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { ChannelService } from '@/channel/channel.service';
import { ChannelOwnerGuard } from '@/auth/channel-owner.guard';
import { StarEventsService } from './star-events.service';

// Widget de OBS: los votos y las votaciones del canal en tiempo real (Server-Sent Events).
// Es público: solo expone lo que el bot ya publica en el chat.
@Controller('channels/:channel/overlay')
export class OverlayController {
  constructor(
    private readonly channelService: ChannelService,
    private readonly starEvents: StarEventsService,
  ) {}

  @Sse('events')
  async events(
    @Param('channel') channelUsername: string,
  ): Promise<Observable<MessageEvent>> {
    const channel = await this.channelService.getByUsername(channelUsername);
    return this.starEvents.stream(channel.channelId);
  }

  // Evento de prueba para configurar la fuente en OBS sin usar el chat.
  // ?kind=session-open prueba el banner de votación; por defecto, un voto
  @Post('test')
  @HttpCode(204)
  @UseGuards(ChannelOwnerGuard)
  async test(
    @Param('channel') channelUsername: string,
    @Query('kind') kind?: string,
  ): Promise<void> {
    const channel = await this.channelService.getByUsername(channelUsername);
    const common = {
      channelId: channel.channelId,
      mediaType: 'movie' as const,
      title: 'Película de prueba',
      year: new Date().getFullYear(),
      posterUrl: null,
    };

    if (kind === 'session-open') {
      this.starEvents.emit({
        ...common,
        kind: 'session-open',
        minutes: 15,
        categories: [],
      });
      return;
    }

    this.starEvents.emit({
      ...common,
      kind: 'star',
      username: channel.displayName || channel.channelUsername,
      score: 4.5,
      scores: {},
      categories: [],
    });
  }
}
