import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
} from '@nestjs/common';
import { CurrentMovieService } from './current-movie.service';
import type { SetMovieBody } from './current-movie.dto';

@Controller('current-movie')
export class CurrentMovieController {
  constructor(private readonly currentMovieService: CurrentMovieService) {}

  @Post('set')
  async setMovie(@Body() body: SetMovieBody): Promise<string> {
    if (!body.channelUsername || !body.tmdbId) {
      throw new BadRequestException('channelUsername and tmdbId are required.');
    }
    return await this.currentMovieService.setCurrentMovie(body);
  }

  @Get()
  async getCurrentMovie() {
    return await this.currentMovieService.getCurrentMovie('khancerberus'); // TODO: Ask for channelUsername in database configuration
  }

  @Delete()
  async clearCurrentMovie(): Promise<string> {
    return await this.currentMovieService.clearCurrentMovie('khancerberus'); // TODO: Ask for channelUsername in database configuration
  }
}
