import { Body, Controller, Post } from '@nestjs/common';
import { ChannelService } from '@/channel/channel.service';
import type { LoginBody } from '@/channel/channel.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly channelService: ChannelService) {}

  // Login provisional con nombre e ID de Twitch. TODO: OAuth de Twitch/Kick
  @Post('login')
  async login(@Body() body: LoginBody) {
    const channel = await this.channelService.login(body);
    return this.channelService.toProfile(channel);
  }
}
