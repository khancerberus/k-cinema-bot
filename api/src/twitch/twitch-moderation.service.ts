import { Injectable, Logger } from '@nestjs/common';
import { BOT_MOD_SCOPE } from '@/auth/twitch-oauth.service';

interface BotAccess {
  accessToken: string;
  moderatorId: string;
}

// Moderación por la Helix API (Twitch quitó /timeout por IRC).
// BOT_MOD_REFRESH_TOKEN: refresh token de la cuenta del bot con el scope
// moderator:manage:banned_users, emitido por la app TWITCH_CLIENT_ID. Se genera en la web,
// en /bot-token. El access token (dura ~4 h) se pide y se renueva aquí, en memoria.
// https://dev.twitch.tv/docs/api/reference/#ban-user
@Injectable()
export class TwitchModerationService {
  private readonly logger = new Logger(TwitchModerationService.name);
  private access: Promise<BotAccess | null> | null = null;
  // Twitch puede devolver un refresh token nuevo al renovar: se usa el último
  private refreshToken = process.env.BOT_MOD_REFRESH_TOKEN;

  // Timeout de `seconds` segundos. false si no se pudo (sin token, bot sin mod,
  // usuario mod o broadcaster, autorización revocada...)
  async timeout(
    broadcasterId: string,
    userId: string,
    seconds: number,
    reason: string,
  ): Promise<boolean> {
    let response = await this.ban(broadcasterId, userId, seconds, reason);
    // Access token vencido: se renueva una vez y se reintenta
    if (response?.status === 401) {
      this.access = null;
      response = await this.ban(broadcasterId, userId, seconds, reason);
    }
    if (!response) return false;

    if (!response.ok) {
      this.logger.warn(
        `Twitch rechazó el timeout de ${userId} en ${broadcasterId} (${response.status}): ${await response.text()}`,
      );
      return false;
    }
    return true;
  }

  private async ban(
    broadcasterId: string,
    userId: string,
    seconds: number,
    reason: string,
  ): Promise<Response | null> {
    const access = await this.getAccess();
    if (!access) return null;

    try {
      const params = new URLSearchParams({
        broadcaster_id: broadcasterId,
        moderator_id: access.moderatorId,
      });
      return await fetch(
        `https://api.twitch.tv/helix/moderation/bans?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access.accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID ?? '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: { user_id: userId, duration: seconds, reason },
          }),
        },
      );
    } catch (error) {
      this.logger.error(`No se pudo dar timeout a ${userId}`, error as Error);
      return null;
    }
  }

  private getAccess() {
    this.access ??= this.refresh().then((access) => {
      // Si falló, se vuelve a intentar en el próximo timeout
      if (!access) this.access = null;
      return access;
    });
    return this.access;
  }

  private async refresh(): Promise<BotAccess | null> {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    if (!this.refreshToken || !clientId || !clientSecret) {
      this.logger.warn(
        'Faltan BOT_MOD_REFRESH_TOKEN, TWITCH_CLIENT_ID o TWITCH_CLIENT_SECRET: no se puede dar timeout',
      );
      return null;
    }

    try {
      const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        }),
      });
      if (!tokenResponse.ok) {
        this.logger.warn(
          `No se pudo renovar el token del bot (${tokenResponse.status}); genera otro en /bot-token`,
        );
        return null;
      }
      const token = (await tokenResponse.json()) as {
        access_token: string;
        refresh_token?: string;
      };
      if (token.refresh_token) this.refreshToken = token.refresh_token;

      // moderator_id es la cuenta dueña del token
      const validateResponse = await fetch(
        'https://id.twitch.tv/oauth2/validate',
        { headers: { Authorization: `OAuth ${token.access_token}` } },
      );
      if (!validateResponse.ok) {
        this.logger.warn(
          `Twitch no validó el token del bot (${validateResponse.status})`,
        );
        return null;
      }
      const data = (await validateResponse.json()) as {
        user_id: string;
        login: string;
        scopes: string[];
      };
      if (!data.scopes.includes(BOT_MOD_SCOPE)) {
        this.logger.warn(
          `El token del bot (${data.login}) no tiene el scope ${BOT_MOD_SCOPE}`,
        );
      }
      return { accessToken: token.access_token, moderatorId: data.user_id };
    } catch (error) {
      this.logger.error('No se pudo renovar el token del bot', error as Error);
      return null;
    }
  }
}
