import { Module } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { Recommendation } from './recommendation.model';
import { SequelizeModule } from '@nestjs/sequelize';
import { TmdbModule } from '@/tmdb/tmdb.module';

@Module({
  controllers: [RecommendationController],
  providers: [RecommendationService],
  imports: [SequelizeModule.forFeature([Recommendation]), TmdbModule],
})
export class RecommendationModule {}
