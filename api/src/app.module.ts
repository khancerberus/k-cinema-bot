import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { RecommendationModule } from './recommendation/recommendation.module';
import { HttpExceptionFilter } from './exceptions/http-exception.filter';
import { APP_FILTER } from '@nestjs/core';
import { StarModule } from './star/star.module';
import { TmdbModule } from './tmdb/tmdb.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        dialect: 'postgres',
        uri: configService.get<string>('DATABASE_URL'),
        models: [],
        autoLoadModels: true,
        synchronize: true,
        pool: {
          max: 10,
          min: 0,
          acquire: 30000, // Max waiting time
          idle: 10000,
        },
      }),
    }),
    RecommendationModule,
    StarModule,
    TmdbModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
  exports: [AppService],
})
export class AppModule {}
