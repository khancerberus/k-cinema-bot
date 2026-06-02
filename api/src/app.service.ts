import { Injectable } from '@nestjs/common';
import { SetMovieBody } from './app.interface';
import { InjectModel } from '@nestjs/sequelize';
import { CurrentMovie } from './current-movie.model';
import { TmdbService } from './tmdb/tmdb.service';

@Injectable()
export class AppService {
  constructor(
    @InjectModel(CurrentMovie)
    private currentMovieModel: typeof CurrentMovie,
    private readonly tmdbService: TmdbService,
  ) {}

  getHealth(): string {
    return 'OK';
  }

  async setMovie(body: SetMovieBody): Promise<string> {
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
}
