import type { MediaType } from '@/channel/channel.settings';

export interface SetMovieBody {
  // Por defecto 'movie'
  mediaType?: MediaType;
  // TMDB ID (películas) o IGDB ID (juegos)
  itemId?: number;
  // Nombre antiguo de itemId (solo películas)
  tmdbId?: number;
  // Duración de la votación; por defecto la del canal
  minutes?: number;
  // Si es true, el bot avisa en el chat que ya se puede puntuar
  announce?: boolean;
}

export interface ExtendBody {
  minutes: number;
}
