import { Injectable } from '@nestjs/common';
import { Recommendation } from './recommendation.model';
import { InjectModel } from '@nestjs/sequelize';
import { CreateRecommendation } from './recommendation.interface';
import { DuplicatedRecommendationException } from '@/exceptions/duplicated-rec.exception';
import { TmdbService } from '@/tmdb/tmdb.service';

@Injectable()
export class RecommendationService {
  constructor(
    @InjectModel(Recommendation)
    private readonly recommendationModel: typeof Recommendation,
    private readonly tmdbService: TmdbService,
  ) {}

  async createOne(recommendation: CreateRecommendation) {
    const { tmdbId } = recommendation;

    const isAdded = await this.tmdbService.addMovieToList(tmdbId, 8655050);

    if (!isAdded) {
      throw new Error(
        `Failed to add movie with TMDB ID ${tmdbId} to the recommendation list.`,
      );
    }

    try {
      const newRecommendation =
        await this.recommendationModel.create(recommendation);
      return newRecommendation;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.name === 'SequelizeUniqueConstraintError'
      ) {
        throw new DuplicatedRecommendationException();
      }
      throw error;
    }
  }
}
