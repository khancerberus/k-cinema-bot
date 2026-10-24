import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
}

// OAuth de Twitch (Authorization Code Flow). La API es el redirect URI porque
// el client secret no puede vivir en la web estática.
// https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow
@Injectable()
export class TwitchOAuthService {
  constructor(private readonly config: ConfigService) {}

  private get clientId() {
    return this.require('TWITCH_CLIENT_ID');
  }

  private get redirectUri() {
    return this.require('TWITCH_REDIRECT_URI');
  }

  private require(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new InternalServerErrorException(`Falta configurar ${key}.`);
    }
    return value;
  }

  // Sin scopes: solo se necesita saber quién es el usuario
  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: '',
      state,
    });
    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  }

  // Intercambia el code por un access token y devuelve el usuario verificado.
  // El token de Twitch se descarta: la sesión de K-Cinema es un JWT propio.
  async getUserFromCode(code: string): Promise<TwitchUser> {
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.require('TWITCH_CLIENT_SECRET'),
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });
    if (!tokenResponse.ok) {
      throw new Error(
        `Twitch rechazó el código (${tokenResponse.status}): ${await tokenResponse.text()}`,
      );
    }
    const { access_token } = (await tokenResponse.json()) as {
      access_token: string;
    };

    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Client-Id': this.clientId,
      },
    });
    if (!userResponse.ok) {
      throw new Error(
        `No se pudo leer el usuario de Twitch (${userResponse.status})`,
      );
    }
    const { data } = (await userResponse.json()) as { data: TwitchUser[] };
    if (!data?.[0]) {
      throw new Error('Twitch no devolvió el usuario');
    }
    return data[0];
  }
}
