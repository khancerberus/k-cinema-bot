import type { ChannelSettings } from './channel.settings';

export interface LoginBody {
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
