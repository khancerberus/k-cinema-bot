import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ChannelService } from '@/channel/channel.service';
import { SessionService } from './session.service';

// Solo el streamer dueño del canal (:channel) puede pasar: valida el token de sesión
// emitido tras el login con Twitch y compara su ID con el del canal.
@Injectable()
export class ChannelOwnerGuard implements CanActivate {
  constructor(
    private readonly channelService: ChannelService,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const session = await this.sessionService.verifyAuthorization(
      request.header('authorization'),
    );

    const channel = await this.channelService.getByUsername(
      String(request.params.channel ?? ''),
    );

    if (session.sub !== channel.channelId) {
      throw new ForbiddenException(
        'Solo el streamer de este canal puede hacer esto.',
      );
    }

    return true;
  }
}
