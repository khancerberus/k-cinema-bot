import { Module } from '@nestjs/common';
import { DatabaseSetupService } from './database-setup.service';

@Module({
  providers: [DatabaseSetupService],
})
export class DatabaseModule {}
