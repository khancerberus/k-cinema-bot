import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ChannelService } from '@/channel/channel.service';

export const SESSION_HEADER = 'x-channel-session';

// Autenticación PROVISIONAL: la web envía el ID del canal con el que se hizo login.
// No es segura (cualquiera puede enviar la cabecera); es el único punto a reemplazar
// por OAuth de Twitch/Kick.
// TODO: validar un token de sesión emitido tras el OAuth en lugar de la cabecera
@Injectable()
export class ChannelOwnerGuard implements CanActivate {
  constructor(private readonly channelService: ChannelService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const channelParam = request.params.channel;
    const sessionChannelId = request.header(SESSION_HEADER);

    const channel = await this.channelService.getByUsername(
      String(channelParam ?? ''),
    );

    if (!sessionChannelId || sessionChannelId !== channel.channelId) {
      throw new ForbiddenException(
        'Solo el streamer de este canal puede hacer esto.',
      );
    }

    return true;
  }
}
