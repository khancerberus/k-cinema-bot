import { Body, Controller, Post } from '@nestjs/common';
import { CurrentMovieService } from './current-movie.service';
import type { SetMovieBody } from './current-movie.dto';

@Controller()
export class CurrentMovieController {
  constructor(private readonly currentMovieService: CurrentMovieService) {}

  @Post('/set-movie')
  async setMovie(@Body() body: SetMovieBody): Promise<string> {
    return await this.currentMovieService.setCurrentMovie(body);
  }
}
