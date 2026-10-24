import { Global, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TwitchChatService } from './twitch-chat.service';
import { Channel } from '@/channel/channel.model';

@Global()
@Module({
  imports: [SequelizeModule.forFeature([Channel])],
  providers: [TwitchChatService],
  exports: [TwitchChatService],
})
export class TwitchChatModule {}
