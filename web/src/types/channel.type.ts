// Tipos de contenido que se pueden puntuar. A futuro: "series", "game", ...
export type MediaType = "movie";

export type SectionKind = "top-best" | "top-worst" | "recent";

export interface ChannelSection {
  id: string;
  kind: SectionKind;
  mediaType: MediaType;
  title: string;
  size: number;
}

export interface HiddenItem {
  mediaType: MediaType;
  tmdbId: number;
}

export interface ChannelSettings {
  sections: ChannelSection[];
  hidden: HiddenItem[];
}

export interface ChannelProfile {
  channelId: string;
  channelUsername: string;
  platform: string;
  displayName: string;
  description: string;
  accentColor: string;
  settings: ChannelSettings;
}

export const MIN_SECTION_SIZE = 1;
export const MAX_SECTION_SIZE = 20;
