import type { ChannelSettings } from './channel.settings';

// Identidad del streamer verificada por el OAuth de Twitch
export interface VerifiedIdentity {
  channelUsername: string;
  channelId: string;
}

export interface UpdateChannelBody {
  displayName?: string;
  description?: string;
  accentColor?: string;
  settings?: ChannelSettings;
}

// Lo que se expone por la API (perfil público del canal)
export interface ChannelProfile {
  channelId: string;
  channelUsername: string;
  platform: string;
  displayName: string;
  description: string;
  accentColor: string;
  settings: ChannelSettings;
}
