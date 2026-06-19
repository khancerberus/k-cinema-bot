import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';
import { Movie } from './movie.interface';
import { TvShow } from './serie.interface';

export type AddMovieToListResult = 'added' | 'already_exists' | 'failed';

@Injectable()
export class TmdbService {
  private readonly logger = new Logger(TmdbService.name);

  constructor(private readonly httpService: HttpService) {}

  async getMovie(tmdbId: number): Promise<Movie | null> {
    const config = {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
      },
    };

    try {
      const response = await this.httpService.axiosRef.get<Movie>(
        `https://api.themoviedb.org/3/movie/${tmdbId}?append_to_response=credits&language=es-MX`,
        config,
      );

      return response.data;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fetch movie with TMDB ID ${tmdbId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  async getSeries(tmdbId: number): Promise<TvShow | null> {
    const config = {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
      },
    };

    try {
      const response = await this.httpService.axiosRef.get<TvShow>(
        `https://api.themoviedb.org/3/tv/${tmdbId}?append_to_response=credits&language=es-MX`,
        config,
      );

      return response.data;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fetch series with TMDB ID ${tmdbId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  async searchMovieByTitleAndYear(
    title: string,
    year: string,
  ): Promise<Movie[]> {
    const config = {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
      },
      params: {
        query: title,
        year: year,
      },
    };

    try {
      const response = await this.httpService.axiosRef.get<{
        results: Movie[];
      }>(`https://api.themoviedb.org/3/search/movie`, config);
      return response.data.results;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to search movie with title "${title}" and year "${year}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  async addMovieToList(
    tmdbId: number,
    listId: number,
  ): Promise<AddMovieToListResult> {
    const config = {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    try {
      const response = await this.httpService.axiosRef.post<{
        success: boolean;
        status_code: number;
        status_message: string;
      }>(
        `https://api.themoviedb.org/3/list/${listId}/add_item`,
        JSON.stringify({ media_id: tmdbId }),
        config,
      );

      if (response.data.success === true) {
        return 'added';
      }

      if (response.data.status_code === 8) {
        return 'already_exists';
      }

      return 'failed';
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.response?.data) {
        const responseData = error.response.data as {
          status_code?: number;
          status_message?: string;
        };

        if (responseData.status_code === 8) {
          this.logger.warn(
            `Movie with TMDB ID ${tmdbId} is already in TMDB list ${listId}.`,
          );
          return 'already_exists';
        }
      }

      this.logger.error(
        `Failed to add movie with TMDB ID ${tmdbId} to list ${listId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return 'failed';
    }
  }
}
