import { Body, Controller, Post } from '@nestjs/common';
import { StarService } from './star.service';
import type { SubmitStarDto } from './star.dto';

@Controller('star')
export class StarController {
  constructor(private readonly starService: StarService) {}

  @Post('submit')
  submitStar(@Body() submitStarDto: SubmitStarDto) {
    return this.starService.submitStar(submitStarDto);
  }
}
