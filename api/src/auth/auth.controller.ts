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
// El state del flujo del bot empieza con esto, para que el callback sepa a dónde volver
const BOT_STATE_PREFIX = 'bot-';

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
    const state = this.setState(req, res, '');
    res.redirect(this.twitchOAuth.buildAuthorizeUrl(state));
  }

  // Autoriza la cuenta del bot para dar timeouts en !rec. Vuelve por el mismo callback
  // y termina en la web, en /bot-token, con el refresh token en el fragmento.
  @Get('twitch/bot')
  startBotAuthorization(@Req() req: Request, @Res() res: Response) {
    const state = this.setState(req, res, BOT_STATE_PREFIX);
    res.redirect(this.twitchOAuth.buildBotAuthorizeUrl(state));
  }

  @Get('twitch/callback')
  async twitchCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    const expectedState = (req.cookies as Record<string, string | undefined>)[
      STATE_COOKIE
    ];
    res.clearCookie(STATE_COOKIE);
    const isBot = Boolean(expectedState?.startsWith(BOT_STATE_PREFIX));
    const webPath = isBot ? '/bot-token' : '/';

    if (error) {
      // access_denied es cancelar; cualquier otro error se muestra tal cual lo manda Twitch
      return this.redirectToWeb(
        res,
        {
          error:
            error === 'access_denied'
              ? 'Cancelaste el login con Twitch.'
              : `Twitch: ${errorDescription ?? error} (${error})`,
        },
        webPath,
      );
    }
    if (!code || !state || !expectedState || !sameState(state, expectedState)) {
      return this.redirectToWeb(
        res,
        { error: 'El login caducó o no es válido, inténtalo de nuevo.' },
        webPath,
      );
    }

    if (isBot) {
      try {
        const token = await this.twitchOAuth.getBotTokenFromCode(code);
        return this.redirectToWeb(
          res,
          {
            refresh_token: token.refreshToken,
            login: token.login,
            scopes: (token.scopes ?? []).join(' '),
          },
          webPath,
        );
      } catch (err) {
        this.logger.error('Falló la autorización del bot', err as Error);
        return this.redirectToWeb(
          res,
          { error: 'No se pudo autorizar la cuenta del bot.' },
          webPath,
        );
      }
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

  private setState(req: Request, res: Response, prefix: string) {
    const state = `${prefix}${randomBytes(24).toString('hex')}`;
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      maxAge: STATE_MAX_AGE_MS,
    });
    return state;
  }

  private redirectToWeb(
    res: Response,
    fragment: Record<string, string>,
    path = '/',
  ) {
    const webUrl = (
      this.config.get<string>('WEB_URL') ?? 'http://localhost:5173'
    ).replace(/\/+$/, '');
    res.redirect(
      `${webUrl}${path}#${new URLSearchParams(fragment).toString()}`,
    );
  }
}
