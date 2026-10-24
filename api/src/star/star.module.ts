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
import { ChannelModule } from '@/channel/channel.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Star, CurrentMovie]),
    UserModule,
    TmdbModule,
    ChannelModule,
  ],
  controllers: [StarController, CurrentMovieController],
  providers: [StarService, CurrentMovieService],
  exports: [SequelizeModule, StarService, CurrentMovieService],
})
export class StarModule {}
