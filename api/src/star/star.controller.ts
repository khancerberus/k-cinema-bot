import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { StarService } from './star.service';
import { ChannelService } from '@/channel/channel.service';

// Ratings públicos de un canal. Las estrellas se envían desde el chat (!star)
@Controller('channels/:channel/movies')
export class StarController {
  constructor(
    private readonly starService: StarService,
    private readonly channelService: ChannelService,
  ) {}

  @Get()
  async getMovies(@Param('channel') channelUsername: string) {
    const channel = await this.channelService.getByUsername(channelUsername);
    return this.starService.getMovies(channel.channelId);
  }

  @Get(':tmdbId')
  async getMovieDetails(
    @Param('channel') channelUsername: string,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
  ) {
    const channel = await this.channelService.getByUsername(channelUsername);
    return this.starService.getMovieDetails(channel.channelId, tmdbId);
  }
}
