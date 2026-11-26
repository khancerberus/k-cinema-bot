import { Body, Controller, Get, Post } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import type { RecommendationBody } from './recommendation.interface';

@Controller('recommendation')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  // Lista pública de recomendaciones (lista de TMDB + quién recomendó)
  @Get()
  async findAll() {
    return await this.recommendationService.findAll();
  }

  @Post()
  async createRecommendation(@Body() recommendation: RecommendationBody) {
    return await this.recommendationService.recommend(recommendation);
  }
}
