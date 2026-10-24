import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Channel } from '@/channel/channel.model';

export interface SessionPayload {
  // ID de Twitch del canal
  sub: string;
  login: string;
}

// Punto único de sesión: firma y valida el token que la web guarda tras el OAuth.
// Es un JWT sin estado, la web lo envía como "Authorization: Bearer <token>"
// (no se usan cookies porque la web vive en otro dominio, p. ej. Vercel)
@Injectable()
export class SessionService {
  constructor(private readonly jwtService: JwtService) {}

  sign(channel: Channel): Promise<string> {
    const payload: SessionPayload = {
      sub: channel.channelId,
      login: channel.channelUsername,
    };
    return this.jwtService.signAsync(payload);
  }

  // Devuelve la sesión del header Authorization o lanza 401
  async verifyAuthorization(
    authorization: string | undefined,
  ): Promise<SessionPayload> {
    const [scheme, token] = (authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Inicia sesión con Twitch.');
    }

    try {
      return await this.jwtService.verifyAsync<SessionPayload>(token);
    } catch {
      throw new UnauthorizedException(
        'La sesión expiró, vuelve a entrar con Twitch.',
      );
    }
  }
}
