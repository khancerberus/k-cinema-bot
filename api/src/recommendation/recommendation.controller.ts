import { Body, Controller, Post } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import type { RecommendationBody } from './recommendation.interface';

@Controller('recommendation')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Post()
  async createRecommendation(@Body() recommendation: RecommendationBody) {
    return await this.recommendationService.recommend(recommendation);
  }
}
