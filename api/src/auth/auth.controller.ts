import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  Controller,
  Get,
  HttpException,
  Logger,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { ChannelService } from '@/channel/channel.service';
import { SessionService } from './session.service';
import { TwitchOAuthService } from './twitch-oauth.service';

const STATE_COOKIE = 'kc_oauth_state';
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

const sameState = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Login con Twitch: la web navega a /auth/twitch, Twitch vuelve a /auth/twitch/callback
// y la API redirige a la web con el token en el fragmento (#token=...), que no llega a
// ningún servidor. Así funciona con la web en hosting estático (p. ej. Vercel).
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly channelService: ChannelService,
    private readonly sessionService: SessionService,
    private readonly twitchOAuth: TwitchOAuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('twitch')
  startTwitchLogin(@Req() req: Request, @Res() res: Response) {
    const state = randomBytes(24).toString('hex');
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      maxAge: STATE_MAX_AGE_MS,
    });
    res.redirect(this.twitchOAuth.buildAuthorizeUrl(state));
  }

  @Get('twitch/callback')
  async twitchCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const expectedState = (req.cookies as Record<string, string | undefined>)[
      STATE_COOKIE
    ];
    res.clearCookie(STATE_COOKIE);

    if (error) {
      return this.redirectToWeb(res, {
        error: 'Cancelaste el login con Twitch.',
      });
    }
    if (!code || !state || !expectedState || !sameState(state, expectedState)) {
      return this.redirectToWeb(res, {
        error: 'El login caducó o no es válido, inténtalo de nuevo.',
      });
    }

    try {
      const twitchUser = await this.twitchOAuth.getUserFromCode(code);
      const channel = await this.channelService.upsertFromTwitch({
        channelId: twitchUser.id,
        channelUsername: twitchUser.login,
      });
      const token = await this.sessionService.sign(channel);
      return this.redirectToWeb(res, { token });
    } catch (err) {
      if (err instanceof HttpException) {
        return this.redirectToWeb(res, { error: err.message });
      }
      this.logger.error('Falló el login con Twitch', err as Error);
      return this.redirectToWeb(res, {
        error: 'No se pudo iniciar sesión con Twitch.',
      });
    }
  }

  // Perfil del canal con sesión iniciada (la web lo pide tras recibir el token)
  @Get('me')
  async me(@Req() req: Request) {
    const session = await this.sessionService.verifyAuthorization(
      req.header('authorization'),
    );
    const channel = await this.channelService.findById(session.sub);
    if (!channel) {
      throw new UnauthorizedException('Vuelve a entrar con Twitch.');
    }
    return this.channelService.toProfile(channel);
  }

  private redirectToWeb(res: Response, fragment: Record<string, string>) {
    const webUrl = (
      this.config.get<string>('WEB_URL') ?? 'http://localhost:5173'
    ).replace(/\/+$/, '');
    res.redirect(`${webUrl}/#${new URLSearchParams(fragment).toString()}`);
  }
}
