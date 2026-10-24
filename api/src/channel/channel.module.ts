import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Channel } from './channel.model';
import { ChannelService } from './channel.service';
import { ChannelController } from './channel.controller';
import { AuthController } from '@/auth/auth.controller';
import { ChannelOwnerGuard } from '@/auth/channel-owner.guard';

@Module({
  imports: [SequelizeModule.forFeature([Channel])],
  controllers: [ChannelController, AuthController],
  providers: [ChannelService, ChannelOwnerGuard],
  exports: [ChannelService, ChannelOwnerGuard],
})
export class ChannelModule {}
