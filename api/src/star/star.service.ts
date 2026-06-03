import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateStarDto, SubmitStarDto } from './star.dto';
import { UserService } from '@/user/user.service';
import { CurrentMovieService } from './current-movie.service';
import { InjectModel } from '@nestjs/sequelize';
import { Star } from './star.model';
import { Op } from 'sequelize';
import { TmdbService } from '@/tmdb/tmdb.service';

export interface MovieStar {
  title: string;
  year: string;
  director: string;
  synopsis: string;
  rating: number;
  lastWatched: string;
  posterUrl: string;
}

@Injectable()
export class StarService {
  constructor(
    @InjectModel(Star)
    private starModel: typeof Star,
    private readonly currentMovieService: CurrentMovieService,
    private readonly userService: UserService,
    private readonly tmdbService: TmdbService,
  ) {}

  async createStar(starData: CreateStarDto) {
    return this.starModel.create(starData);
  }

  async getStarsByMovie(tmdbId: number) {
    return this.starModel.findAll({ where: { tmdbId } });
  }

  async getMovies(): Promise<MovieStar[]> {
    // The last seen is the most recent star for each movie, so we can order by createdAt and group by tmdbId
    const ratedMovies = await this.starModel.findAll({
      attributes: ['tmdbId'],
      group: ['tmdbId'],
    });

    const stars = await this.starModel.findAll({
      attributes: ['tmdbId', 'score', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    const movies = await Promise.all(
      ratedMovies.map(async (movie) => {
        const movieDetail = await this.tmdbService.getMovie(movie.tmdbId);

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

        return {
          title: movieDetail?.title || 'Unknown',
          year: movieDetail?.release_date.split('-')[0] || 'Unknown',
          director:
            movieDetail?.credits.crew.find(
              (member) => member.job === 'Director',
            )?.name || 'Unknown',
          rating: roundedAverageRating,
          synopsis: movieDetail?.overview || 'No synopsis available',
          lastWatched: lastWatchedAt
            ? lastWatchedAt.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
              })
            : 'Unknown',
          posterUrl: movieDetail?.poster_path
            ? `https://image.tmdb.org/t/p/w500${movieDetail.poster_path}`
            : 'No poster available',
        };
      }),
    );

    return movies;
  }

  async submitStar(submitStarDto: SubmitStarDto) {
    const currentMovie = await this.currentMovieService.getCurrentMovie(
      submitStarDto.channelUsername,
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
