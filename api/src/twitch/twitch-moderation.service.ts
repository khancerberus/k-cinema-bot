import { Injectable, Logger } from '@nestjs/common';

// Moderación por la Helix API (Twitch quitó /timeout por IRC).
// BOT_MOD_TOKEN: token de la cuenta del bot con el scope moderator:manage:banned_users,
// emitido por la app TWITCH_CLIENT_ID. Se genera en la web, en /bot-token.
// https://dev.twitch.tv/docs/api/reference/#ban-user
@Injectable()
export class TwitchModerationService {
  private readonly logger = new Logger(TwitchModerationService.name);
  // user_id de la cuenta dueña de BOT_MOD_TOKEN (va como moderator_id)
  private moderatorId: Promise<string | null> | null = null;

  // Timeout de `seconds` segundos. false si no se pudo (sin token, bot sin mod,
  // usuario mod o broadcaster, token vencido...)
  async timeout(
    broadcasterId: string,
    userId: string,
    seconds: number,
    reason: string,
  ): Promise<boolean> {
    const token = process.env.BOT_MOD_TOKEN;
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!token || !clientId) {
      this.logger.warn(
        'Faltan BOT_MOD_TOKEN o TWITCH_CLIENT_ID: no se puede dar timeout',
      );
      return false;
    }

    const moderatorId = await this.getModeratorId(token);
    if (!moderatorId) return false;

    try {
      const params = new URLSearchParams({
        broadcaster_id: broadcasterId,
        moderator_id: moderatorId,
      });
      const response = await fetch(
        `https://api.twitch.tv/helix/moderation/bans?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Client-Id': clientId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: { user_id: userId, duration: seconds, reason },
          }),
        },
      );

      if (!response.ok) {
        // Token vencido o revocado: se vuelve a validar en el próximo intento
        if (response.status === 401) this.moderatorId = null;
        this.logger.warn(
          `Twitch rechazó el timeout de ${userId} en ${broadcasterId} (${response.status}): ${await response.text()}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(`No se pudo dar timeout a ${userId}`, error as Error);
      return false;
    }
  }

  private getModeratorId(token: string) {
    this.moderatorId ??= this.validate(token);
    return this.moderatorId;
  }

  private async validate(token: string): Promise<string | null> {
    try {
      const response = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: `OAuth ${token}` },
      });
      if (!response.ok) {
        this.logger.warn(
          `BOT_MOD_TOKEN no es válido (${response.status}); genera otro en /bot-token`,
        );
        this.moderatorId = null;
        return null;
      }
      const data = (await response.json()) as {
        user_id: string;
        scopes: string[];
      };
      if (!data.scopes.includes('moderator:manage:banned_users')) {
        this.logger.warn(
          'BOT_MOD_TOKEN no tiene el scope moderator:manage:banned_users',
        );
      }
      return data.user_id;
    } catch (error) {
      this.logger.error('No se pudo validar BOT_MOD_TOKEN', error as Error);
      this.moderatorId = null;
      return null;
    }
  }
}
