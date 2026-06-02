import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CurrentMovie } from './current-movie.model';
import { TmdbService } from '@/tmdb/tmdb.service';
import { SetMovieBody } from './current-movie.dto';

@Injectable()
export class CurrentMovieService {
  constructor(
    @InjectModel(CurrentMovie)
    private currentMovieModel: typeof CurrentMovie,
    private readonly tmdbService: TmdbService,
  ) {}

  async setCurrentMovie(body: SetMovieBody): Promise<string> {
    const { channelUsername, tmdbId } = body;

    const movie = await this.tmdbService.getMovie(tmdbId);

    const [, created] = await this.currentMovieModel.upsert(
      {
        channelUsername,
        tmdbId,
      },
      { returning: true },
    );

    if (!movie) {
      return `La película con TMDB ID ${tmdbId} no se encontró.`;
    }

    const status = created ? 'establecido' : 'actualizado';

    return `La pelicula se ha ${status} a "${movie.title} (${movie.release_date.split('-')[0]})" con TMDB ID ${tmdbId}`;
  }

  async getCurrentMovie(channelUsername: string): Promise<{
    tmdbId: number;
    title: string;
    releaseYear: string;
  }> {
    const currentMovie = await this.currentMovieModel.findOne({
      where: { channelUsername },
    });

    if (!currentMovie) {
      throw new NotFoundException(
        `No se encontró una película actual para el canal ${channelUsername}.`,
      );
    }

    const movie = await this.tmdbService.getMovie(currentMovie.tmdbId);

    if (!movie) {
      throw new NotFoundException(
        `La película con TMDB ID ${currentMovie.tmdbId} no se encontró.`,
      );
    }

    return {
      tmdbId: currentMovie.tmdbId,
      title: movie.title,
      releaseYear: movie.release_date.split('-')[0],
    };
  }
}
