import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateStarDto, SubmitStarDto } from './star.dto';
import { UserService } from '@/user/user.service';
import { CurrentMovieService } from './current-movie.service';
import { InjectModel } from '@nestjs/sequelize';
import { Star } from './star.model';
import { Op } from 'sequelize';
import { TmdbService } from '@/tmdb/tmdb.service';
import Redis from 'ioredis';

export interface MovieStar {
  tmdbId: number;
  title: string;
  year: string;
  director: string;
  synopsis: string;
  rating: number;
  lastWatched: Date;
  posterUrl: string;
}

export interface TmdbCrewMember {
  job: string;
  name: string;
}

export interface TmdbMovieDetail {
  title: string;
  release_date: string;
  overview: string;
  poster_path: string;
  credits: {
    crew: TmdbCrewMember[];
  };
}

export interface StarRecord {
  tmdbId: number;
  score: number;
  createdAt: Date;
}

export interface MovieDetailResponse {
  tmdbId: number;
  title: string;
  year: string;
  director: string;
  rating: number;
  synopsis: string;
  lastWatched: string;
  posterUrl: string;
  stars: Array<{
    username: string;
    score: number;
    createdAt: Date;
  }>;
}

export interface SubmitStarResponse {
  message: string;
  currentMovie: Record<string, unknown>;
  stars: number;
}

@Injectable()
export class StarService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @InjectModel(Star)
    private starModel: typeof Star,
    private readonly currentMovieService: CurrentMovieService,
    private readonly userService: UserService,
    private readonly tmdbService: TmdbService,
  ) {}

  async createStar(starData: CreateStarDto) {
    return this.starModel.create(starData);
  }

  // Obtiene los datos estáticos de TMDB desde Redis, o de TMDB si no están en caché
  private async getCachedMovie(
    tmdbId: number,
  ): Promise<TmdbMovieDetail | null> {
    const cacheKey = `tmdb:movie:${tmdbId}`;
    const cachedData = await this.redis.get(cacheKey);

    if (cachedData) {
      const parsedMovieDetail: unknown = JSON.parse(cachedData);
      return parsedMovieDetail as TmdbMovieDetail;
    }

    const movieDetail = await this.tmdbService.getMovie(tmdbId);

    // Guardamos en Redis por 1 año (365 días = 31536000 segundos)
    if (movieDetail) {
      await this.redis.set(
        cacheKey,
        JSON.stringify(movieDetail),
        'EX',
        31536000,
      );
    }

    return movieDetail;
  }

  async getStarsByMovie(channelId: string, tmdbId: number) {
    return this.starModel.findAll({
      where: { channelId, tmdbId },
      order: [['createdAt', 'DESC']],
    });
  }

  async getMovies(channelId: string): Promise<MovieStar[]> {
    // The last seen is the most recent star for each movie, so we can order by createdAt and group by tmdbId
    const ratedMovies = await this.starModel.findAll({
      attributes: ['tmdbId'],
      where: { channelId },
      group: ['tmdbId'],
    });

    const stars = await this.starModel.findAll({
      attributes: ['tmdbId', 'score', 'createdAt'],
      where: { channelId },
      order: [['createdAt', 'DESC']],
    });

    const movies = await Promise.all(
      ratedMovies.map(async (movie) => {
        const movieDetail = await this.getCachedMovie(movie.tmdbId);

        // Cálculos dinámicos (estrellas y fechas) se ejecutan SIEMPRE
        // Así te aseguras de que el usuario siempre vea su última valoración real
        const movieTmdbId = Number(movie.tmdbId);
        const movieStars = stars.filter(
          (s) => Number(s.tmdbId) === movieTmdbId,
        );

        const averageRating =
          movieStars.length > 0
            ? movieStars.reduce((sum, s) => sum + Number(s.score), 0) /
              movieStars.length
            : 0;
        const roundedAverageRating = Number(averageRating.toFixed(1));
        const lastWatchedAt = movieStars[0]?.createdAt;

        // Retornamos el objeto combinado
        return {
          tmdbId: movie.tmdbId,
          title: movieDetail?.title || 'Unknown',
          // Agregado el '?' antes de .split para evitar crashes si release_date es undefined
          year: movieDetail?.release_date?.split('-')[0] || 'Unknown',
          director:
            movieDetail?.credits?.crew
              ?.filter((member: { job: string }) => member.job === 'Director')
              .map((director: { name: string }) => director.name)
              .join(', ') || 'Unknown',
          rating: roundedAverageRating,
          synopsis: movieDetail?.overview || 'No synopsis available',
          lastWatched: lastWatchedAt,
          posterUrl: movieDetail?.poster_path
            ? `https://image.tmdb.org/t/p/w500${movieDetail.poster_path}`
            : 'No poster available',
        };
      }),
    );

    return movies;
  }

  async getMovieDetails(channelId: string, tmdbId: number) {
    const movieDetail = await this.getCachedMovie(tmdbId);
    const stars = await this.getStarsByMovie(channelId, tmdbId);
    const users = await this.userService.getAll();

    return {
      tmdbId,
      title: movieDetail?.title || 'Unknown',
      year: movieDetail?.release_date.split('-')[0] || 'Unknown',
      director:
        movieDetail?.credits.crew
          .filter((member) => member.job === 'Director')
          .map((director) => director.name)
          .join(', ') || 'Unknown',
      rating:
        stars.length > 0
          ? Number(
              (
                stars.reduce((sum, s) => sum + Number(s.score), 0) /
                stars.length
              ).toFixed(1),
            )
          : 0,
      synopsis: movieDetail?.overview || 'No synopsis available',
      lastWatched:
        stars.length > 0
          ? stars[0].createdAt.toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
            })
          : 'Unknown',
      posterUrl: movieDetail?.poster_path
        ? `https://image.tmdb.org/t/p/w500${movieDetail.poster_path}`
        : 'No poster available',
      stars: stars.map((s) => {
        const user = users.find((u) => u.userId === s.userId);
        return {
          username: user?.username || 'Unknown',
          score: s.score,
          createdAt: s.createdAt,
        };
      }),
    };
  }

  async submitStar(submitStarDto: SubmitStarDto) {
    const currentMovie = await this.currentMovieService.getCurrentMovie(
      submitStarDto.channelId,
    );

    let user = await this.userService.getUserById(submitStarDto.userId);
    if (!user) {
      user = await this.userService.createUser({
        userId: submitStarDto.userId,
        username: submitStarDto.username,
      });
    } else {
      if (user.username !== submitStarDto.username) {
        user.username = submitStarDto.username;
        await user.save();
      }
    }

    const today = new Date();

    const existingStar = await this.starModel.findOne({
      where: {
        userId: user.userId,
        tmdbId: currentMovie.tmdbId,
        channelId: submitStarDto.channelId,
        createdAt: {
          [Op.gte]: new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
          ),
        },
      },
    });

    if (existingStar) {
      throw new BadRequestException(
        `${submitStarDto.username} ya ha dado ${existingStar.score} estrellas a "${currentMovie.title} (${currentMovie.releaseYear})" hoy. Solo se permite una valoración por película al día.`,
      );
    }

    await this.createStar({
      userId: user.userId,
      tmdbId: currentMovie.tmdbId,
      channelId: submitStarDto.channelId,
      mediaType: 'movie',
      score: submitStarDto.stars,
    });

    const fullStars = Math.floor(submitStarDto.stars);
    const hasHalfStar = submitStarDto.stars % 1 !== 0;
    const starsAsEmotes = `${'⭐'.repeat(fullStars)}${hasHalfStar ? '½' : ''}`;

    return {
      message: `${submitStarDto.username} ha dado ${starsAsEmotes} (${submitStarDto.stars}) estrellas a "${currentMovie.title} (${currentMovie.releaseYear})"`,
      currentMovie,
      stars: submitStarDto.stars,
    };
  }
}
