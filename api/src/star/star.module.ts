import { Module } from '@nestjs/common';
import { StarService } from './star.service';
import { StarController } from './star.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Star } from './star.model';
import { UserModule } from '@/user/user.module';
import { CurrentMovie } from './current-movie.model';
import { CurrentMovieService } from './current-movie.service';
import { TmdbModule } from '@/tmdb/tmdb.module';
import { CurrentMovieController } from './current-movie.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([Star, CurrentMovie]),
    UserModule,
    TmdbModule,
  ],
  controllers: [StarController, CurrentMovieController],
  providers: [StarService, CurrentMovieService],
  exports: [SequelizeModule, StarService, CurrentMovieService],
})
export class StarModule {}
