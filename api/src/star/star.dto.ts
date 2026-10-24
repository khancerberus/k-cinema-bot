import type { MediaType } from '@/channel/channel.settings';

export interface Star {
  id: number;
  userId: number;
  tmdbId: number;
  channelId: string;
  mediaType?: MediaType;
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmitStarDto {
  channelId: string;
  userId: number;
  username: string;
  stars: number;
}

export type CreateStarDto = Omit<Star, 'id' | 'createdAt' | 'updatedAt'>;

export const MOVIE_SORT_KEYS = [
  'title',
  'rating',
  'lastWatched',
  'year',
] as const;
export type MovieSortKey = (typeof MOVIE_SORT_KEYS)[number];
export type SortDirection = 'asc' | 'desc';

// Consulta de películas puntuadas de un canal (ya validada en el controller)
export interface MovieListQuery {
  q?: string;
  page: number;
  pageSize: number;
  sort: MovieSortKey;
  dir: SortDirection;
  minRating?: number;
  maxRating?: number;
  watchedFrom?: Date;
  watchedTo?: Date;
  minYear?: number;
  maxYear?: number;
  // Solo estas películas (p. ej. los títulos de las ocultas del perfil)
  ids?: number[];
}

export interface MoviePage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
