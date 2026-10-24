import { Module } from '@nestjs/common';
import { StarModule } from '@/star/star.module';
import { RecommendationModule } from '@/recommendation/recommendation.module';
import { ChannelModule } from '@/channel/channel.module';
import { TwitchCommandsService } from './twitch-commands.service';

@Module({
  imports: [StarModule, RecommendationModule, ChannelModule],
  providers: [TwitchCommandsService],
})
export class TwitchBotModule {}
