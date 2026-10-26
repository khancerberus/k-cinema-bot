import { Module } from '@nestjs/common';
import { StarService } from './star.service';
import { GameController, StarController } from './star.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Star } from './star.model';
import { StarScore } from './star-score.model';
import { StarAppeal } from './star-appeal.model';
import { RatingSession } from './rating-session.model';
import { UserModule } from '@/user/user.module';
import { CurrentMovie } from './current-movie.model';
import { RatingSessionService } from './rating-session.service';
import { AppealService } from './appeal.service';
import { CurrentMovieController } from './current-movie.controller';
import { ChannelModule } from '@/channel/channel.module';
import { MovieModule } from '@/movie/movie.module';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Star,
      StarScore,
      StarAppeal,
      RatingSession,
      CurrentMovie,
    ]),
    UserModule,
    ChannelModule,
    MovieModule,
  ],
  controllers: [StarController, GameController, CurrentMovieController],
  providers: [StarService, RatingSessionService, AppealService],
  exports: [SequelizeModule, StarService, RatingSessionService, AppealService],
})
export class StarModule {}
