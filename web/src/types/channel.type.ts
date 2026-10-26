// Tipos de contenido que se pueden puntuar. A futuro: "series", ...
export type MediaType = "movie" | "game";

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

// Comandos del bot personalizables. En !kcinema, {url} es el enlace al perfil
export interface ChannelCommands {
  kcinema: { message: string };
}

// Categoría de puntuación. La key no cambia: renombrar cambia la label y quitarla la archiva
export interface RatingCategory {
  key: string;
  label: string;
  archived?: boolean;
}

export interface ChannelSettings {
  sections: ChannelSection[];
  hidden: HiddenItem[];
  commands: ChannelCommands;
  // Sin categorías activas se puntúa con una sola nota
  rating: { categories: Record<MediaType, RatingCategory[]> };
  // Duración por defecto de la votación al activar un contenido
  voting: { defaultMinutes: number };
  // !apelar en el chat
  appeals: { enabled: boolean };
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
export const MAX_KCINEMA_MESSAGE_LENGTH = 300;
export const MAX_CATEGORIES = 6;
export const MAX_CATEGORY_LABEL_LENGTH = 20;
export const MIN_VOTING_MINUTES = 10;
export const MAX_VOTING_MINUTES = 240;

export const MEDIA_LABELS: Record<MediaType, { singular: string; plural: string; creator: string }> = {
  movie: { singular: "película", plural: "películas", creator: "Director" },
  game: { singular: "juego", plural: "juegos", creator: "Desarrolladora" },
};

// Rutas de la web y de la API de cada tipo
export const MEDIA_PATHS: Record<MediaType, { list: string; item: string; api: string }> = {
  movie: { list: "rated-movies", item: "movie", api: "movies" },
  game: { list: "rated-games", item: "game", api: "games" },
};

export const itemPath = (channelUsername: string, mediaType: MediaType, id: number) =>
  `/${channelUsername}/${MEDIA_PATHS[mediaType].list}/${MEDIA_PATHS[mediaType].item}/${id}`;

// Nombre de la fuente de datos (el enlace, sourceUrl, lo da la API)
export const SOURCE_LABELS: Record<MediaType, string> = { movie: "TMDB ID", game: "IGDB ID" };
