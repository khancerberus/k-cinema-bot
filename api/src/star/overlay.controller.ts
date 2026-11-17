import {
  Controller,
  HttpCode,
  type MessageEvent,
  Param,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { ChannelService } from '@/channel/channel.service';
import { ChannelOwnerGuard } from '@/auth/channel-owner.guard';
import { StarEventsService } from './star-events.service';

// Widget de OBS: los votos del canal en tiempo real (Server-Sent Events).
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

  // Voto de prueba para configurar la fuente en OBS sin votar en el chat
  @Post('test')
  @HttpCode(204)
  @UseGuards(ChannelOwnerGuard)
  async test(@Param('channel') channelUsername: string): Promise<void> {
    const channel = await this.channelService.getByUsername(channelUsername);
    this.starEvents.emit({
      channelId: channel.channelId,
      username: channel.displayName || channel.channelUsername,
      mediaType: 'movie',
      title: 'Película de prueba',
      year: new Date().getFullYear(),
      posterUrl: null,
      score: 4.5,
      scores: {},
      categories: [],
    });
  }
}
