import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import type { SetMovieBody } from './app.interface';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(): string {
    return this.appService.getHealth();
  }

  @Post('/set-movie')
  async setMovie(@Body() body: SetMovieBody): Promise<string> {
    return await this.appService.setMovie(body);
  }
}
