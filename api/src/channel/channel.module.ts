import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SequelizeModule } from '@nestjs/sequelize';
import { Channel } from './channel.model';
import { ChannelService } from './channel.service';
import { ChannelController } from './channel.controller';
import { AuthController } from '@/auth/auth.controller';
import { ChannelOwnerGuard } from '@/auth/channel-owner.guard';
import { SessionService } from '@/auth/session.service';
import { TwitchOAuthService } from '@/auth/twitch-oauth.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Channel]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('SESSION_SECRET');
        if (!secret) {
          throw new Error('Falta configurar SESSION_SECRET.');
        }
        return { secret, signOptions: { expiresIn: '30d' } };
      },
    }),
  ],
  controllers: [ChannelController, AuthController],
  providers: [
    ChannelService,
    ChannelOwnerGuard,
    SessionService,
    TwitchOAuthService,
  ],
  exports: [ChannelService, ChannelOwnerGuard, SessionService],
})
export class ChannelModule {}
