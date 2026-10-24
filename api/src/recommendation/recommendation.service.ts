import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { Recommendation } from './recommendation.model';
import { InjectModel } from '@nestjs/sequelize';
import {
  CreateRecommendation,
  RecommendationBody,
} from './recommendation.interface';
import { DuplicatedRecommendationException } from '@/exceptions/duplicated-rec.exception';
import { TmdbService } from '@/tmdb/tmdb.service';
import { extractTmdbId } from '@/utils/url-decoder.utils';

@Injectable()
export class RecommendationService {
  constructor(
    @InjectModel(Recommendation)
    private readonly recommendationModel: typeof Recommendation,
    private readonly tmdbService: TmdbService,
  ) {}

  // Valida la entrada, guarda la recomendación y devuelve el mensaje para el chat
  async recommend(recommendation: RecommendationBody): Promise<string> {
    if (!recommendation.userId || !recommendation.movieOrTmdbId) {
      throw new BadRequestException('Invalid recommendation data');
    }

    // Can be either a TMDB ID (number), TMDB URL, or "movie (year)" format
    if (
      isNaN(Number(recommendation.movieOrTmdbId)) && // Not a number
      !/^https?:\/\/(www\.)?themoviedb\.org\/(movie|tv)\/\d+/.test(
        recommendation.movieOrTmdbId,
      ) && // Not a TMDB URL
      !/.+\s\(\d{4}\)/.test(recommendation.movieOrTmdbId) // Not "movie (year)" format
    ) {
      throw new BadRequestException('Invalid movieOrTmdbId format');
    }

    let tmdbId: number | null = null;

    // If it's a TMDB URL, extract the TMDB ID
    if (
      /^https?:\/\/(www\.)?themoviedb\.org\/(movie|tv)\/\d+/.test(
        recommendation.movieOrTmdbId,
      )
    ) {
      tmdbId = extractTmdbId(recommendation.movieOrTmdbId);

      if (!tmdbId) {
        throw new BadRequestException('Could not extract TMDB ID from URL');
      }
    }

    if (!tmdbId && !isNaN(Number(recommendation.movieOrTmdbId))) {
      tmdbId = Number(recommendation.movieOrTmdbId);
    }

    // movie (year) format manage
    if (!tmdbId && /.+\s\(\d{4}\)$/.test(recommendation.movieOrTmdbId)) {
      throw new NotImplementedException('Error not yet implemented');

      // const match = recommendation.movieOrTmdbId.match(/(.+)\s\((\d{4})\)$/);
      // if (match) {
      //   const title = match[1].trim();
      //   const year = match[2];

      //   const movies = await this.tmdbService.searchMovieByTitleAndYear(
      //     title,
      //     year,
      //   );
      //   if (movies.length > 0) {
      //     if (movies[0].release_date?.split('-')[0] !== year) {
      //       throw new Error(
      //         `The year provided (${year}) does not match the release year of the found movie (${movies[0].release_date?.split('-')[0] || 'N/A'}). Please check the format and try again.`,
      //       );
      //     }

      //     tmdbId = movies[0].id;

      //     console.log(
      //       `Found TMDB ID ${tmdbId} for title "${title}" and year "${year}"`,
      //     );
      //   } else if (movies.length > 1) {
      //     throw new Error(
      //       `Multiple movies found for title "${title}" and year "${year}". Please specify the TMDB ID or use a more specific title.`,
      //     );
      //   } else {
      //     throw new Error(
      //       `No movie found for title "${title}" and year "${year}"`,
      //     );
      //   }
      // } else {
      //   throw new Error('Invalid "movie (year)" format');
      // }
    }

    if (!tmdbId) {
      throw new BadRequestException('Could not determine TMDB ID from input');
    }

    const recommendationResult = await this.createOne({
      userId: recommendation.userId,
      username: recommendation.username,
      tmdbId,
    });

    if (!recommendationResult) {
      throw new BadRequestException('Failed to create recommendation');
    }

    const movie = await this.tmdbService.getMovie(tmdbId);

    if (!movie) {
      throw new BadRequestException(
        'No pude traer los datos de la película recomendada, pero gracias por tu recomendación!',
      );
    }

    return `@${recommendation.username}, gracias por tu recomendación de ${movie.title} (${movie.release_date?.split('-')[0] || 'N/A'}). ¡La tendremos en cuenta para futuras proyecciones!`;
  }

  async createOne(recommendation: CreateRecommendation) {
    const { tmdbId } = recommendation;

    const addResult = await this.tmdbService.addMovieToList(tmdbId, 8655050);

    if (addResult === 'already_exists') {
      throw new DuplicatedRecommendationException(recommendation.username);
    }

    if (addResult === 'failed') {
      throw new BadGatewayException(
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
        throw new DuplicatedRecommendationException(recommendation.username);
      }
      throw error;
    }
  }
}
