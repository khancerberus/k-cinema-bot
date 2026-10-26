import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TmdbModule } from '@/tmdb/tmdb.module';
import { IgdbModule } from '@/igdb/igdb.module';
import { MovieMetadata } from './movie-metadata.model';
import { MovieService } from './movie.service';
import { GameService } from './game.service';
import { CatalogService } from './catalog.service';

@Module({
  imports: [
    SequelizeModule.forFeature([MovieMetadata]),
    TmdbModule,
    IgdbModule,
  ],
  providers: [MovieService, GameService, CatalogService],
  exports: [MovieService, CatalogService],
})
export class MovieModule {}
