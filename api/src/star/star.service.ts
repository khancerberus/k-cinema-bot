import { Injectable } from '@nestjs/common';
import { CreateStarDto, SubmitStarDto } from './star.dto';
import { UserService } from '@/user/user.service';
import { CurrentMovieService } from './current-movie.service';
import { InjectModel } from '@nestjs/sequelize';
import { Star } from './star.model';
import { Op } from 'sequelize';

@Injectable()
export class StarService {
  constructor(
    @InjectModel(Star)
    private starModel: typeof Star,
    private readonly currentMovieService: CurrentMovieService,
    private readonly userService: UserService,
  ) {}

  async createStar(starData: CreateStarDto) {
    return this.starModel.create(starData);
  }

  async getStarsByMovie(tmdbId: number) {
    return this.starModel.findAll({ where: { tmdbId } });
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
      throw new Error(
        `Usuario ${submitStarDto.username} ya ha dado estrellas a "${currentMovie.title} (${currentMovie.releaseYear})" hoy. Solo se permite una valoración por película al día.`,
      );
    }

    await this.createStar({
      userId: user.userId,
      tmdbId: currentMovie.tmdbId,
      score: submitStarDto.stars,
    });

    return {
      message: `Usuario ${submitStarDto.username} ha dado ${submitStarDto.stars} estrellas a "${currentMovie.title} (${currentMovie.releaseYear})"`,
      currentMovie,
      stars: submitStarDto.stars,
    };
  }
}
