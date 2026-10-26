import type { MediaType } from "./channel.type";

export interface CategoryAverage {
  key: string;
  label: string;
  average: number;
}

export interface Star {
  username: string;
  score: number;
  // categoryKey → nota (vacío si se votó sin categorías)
  scores: Record<string, number>;
  createdAt: string;
}

export interface MovieDetails {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  year: string;
  // Directores (películas) o desarrolladoras (juegos)
  director: string;
  synopsis: string;
  rating: number;
  lastWatched: string;
  posterUrl: string;
  sourceUrl: string | null;
  // Solo juegos
  platforms: string[];
  genres: string[];
  // Solo juegos: año del acceso anticipado si lo hubo antes del 1.0
  earlyAccessYear: number | null;
  categories: CategoryAverage[];
  stars: Star[];
}
