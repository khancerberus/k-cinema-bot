import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IgdbService } from './igdb.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  providers: [IgdbService],
  exports: [IgdbService],
})
export class IgdbModule {}
