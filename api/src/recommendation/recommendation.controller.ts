import { Body, Controller, Post } from '@nestjs/common';
import { RecommendationService } from './recommendation.service';
import type { RecommendationBody } from './recommendation.interface';
import { extractTmdbId } from '@/utils/url-decoder.utils';

@Controller('recommendation')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Post()
  createRecommendation(@Body() recommendation: RecommendationBody) {
    if (!recommendation.userId || !recommendation.movieOrTmdbId) {
      throw new Error('Invalid recommendation data');
    }

    // Can be either a TMDB ID (number), TMDB URL, or "movie (year)" format
    if (
      isNaN(Number(recommendation.movieOrTmdbId)) && // Not a number
      !/^https?:\/\/(www\.)?themoviedb\.org\/(movie|tv)\/\d+/.test(
        recommendation.movieOrTmdbId,
      ) && // Not a TMDB URL
      !/.+\s\(\d{4}\)/.test(recommendation.movieOrTmdbId) // Not "movie (year)" format
    ) {
      throw new Error('Invalid movieOrTmdbId format');
    }

    let tmdbId = null;

    // If it's a TMDB URL, extract the TMDB ID
    if (
      /^https?:\/\/(www\.)?themoviedb\.org\/(movie|tv)\/\d+/.test(
        recommendation.movieOrTmdbId,
      )
    ) {
      tmdbId = extractTmdbId(recommendation.movieOrTmdbId);

      if (!tmdbId) {
        throw new Error('Could not extract TMDB ID from URL');
      }
    }

    if (!tmdbId && !isNaN(Number(recommendation.movieOrTmdbId))) {
      tmdbId = Number(recommendation.movieOrTmdbId);
    }

    // movie (year) format manage
    if (!tmdbId && /.+\s\(\d{4}\)$/.test(recommendation.movieOrTmdbId)) {
      throw new Error('Error not yet implemented');

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
      throw new Error('Could not determine TMDB ID from input');
    }

    return this.recommendationService.createOne({
      userId: recommendation.userId,
      username: recommendation.username,
      tmdbId,
    });
  }
}
