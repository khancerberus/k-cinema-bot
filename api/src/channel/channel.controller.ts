import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ChannelService } from './channel.service';
import type { UpdateChannelBody } from './channel.dto';
import { ChannelOwnerGuard } from '@/auth/channel-owner.guard';

@Controller('channels')
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  @Get(':channel')
  async getChannel(@Param('channel') channelUsername: string) {
    const channel = await this.channelService.getByUsername(channelUsername);
    return this.channelService.toProfile(channel);
  }

  @Patch(':channel')
  @UseGuards(ChannelOwnerGuard)
  async updateChannel(
    @Param('channel') channelUsername: string,
    @Body() body: UpdateChannelBody,
  ) {
    const channel = await this.channelService.getByUsername(channelUsername);
    const updated = await this.channelService.update(channel, body);
    return this.channelService.toProfile(updated);
  }
}
