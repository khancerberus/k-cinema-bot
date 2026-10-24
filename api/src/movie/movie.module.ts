import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TmdbModule } from '@/tmdb/tmdb.module';
import { MovieMetadata } from './movie-metadata.model';
import { MovieService } from './movie.service';

@Module({
  imports: [SequelizeModule.forFeature([MovieMetadata]), TmdbModule],
  providers: [MovieService],
  exports: [MovieService],
})
export class MovieModule {}
