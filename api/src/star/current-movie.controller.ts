import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentMovieService } from './current-movie.service';
import type { SetMovieBody } from './current-movie.dto';
import { ChannelService } from '@/channel/channel.service';
import { ChannelOwnerGuard } from '@/auth/channel-owner.guard';

// Solo el streamer del canal puede ver y cambiar la película en puntuación
@Controller('channels/:channel/current-movie')
@UseGuards(ChannelOwnerGuard)
export class CurrentMovieController {
  constructor(
    private readonly currentMovieService: CurrentMovieService,
    private readonly channelService: ChannelService,
  ) {}

  @Get()
  async getCurrentMovie(@Param('channel') channelUsername: string) {
    const channel = await this.channelService.getByUsername(channelUsername);
    return await this.currentMovieService.getCurrentMovie(channel.channelId);
  }

  @Post()
  async setMovie(
    @Param('channel') channelUsername: string,
    @Body() body: SetMovieBody,
  ): Promise<string> {
    const tmdbId = Number(body?.tmdbId);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      throw new BadRequestException('tmdbId is required.');
    }

    const channel = await this.channelService.getByUsername(channelUsername);
    return (
      await this.currentMovieService.setCurrentMovie(channel, {
        tmdbId,
        announce: body.announce === true,
      })
    ).message;
  }

  // ?announce=true publica en el chat el resumen de la votación
  @Delete()
  async clearCurrentMovie(
    @Param('channel') channelUsername: string,
    @Query('announce') announce?: string,
  ): Promise<string> {
    const channel = await this.channelService.getByUsername(channelUsername);
    return (
      await this.currentMovieService.clearCurrentMovie(
        channel,
        announce === 'true',
      )
    ).message;
  }
}
