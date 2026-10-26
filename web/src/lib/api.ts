import type { FilmMetadataProps } from "../components/MovieRatingCard";
import { clearSession, getSession } from "./session";
import type { MovieSortKey, SortDirection } from "./movie-query";
import { MEDIA_PATHS, type MediaType } from "../types/channel.type";

export const API_URL = import.meta.env.VITE_API_URL ?? "/api";

// La API redirige a Twitch y vuelve a la web con el token en el fragmento (#token=...)
export const TWITCH_LOGIN_URL = `${API_URL}/auth/twitch`;

// fetch contra la API que añade el token de sesión del streamer, si lo hay
export const apiFetch = async (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  const session = getSession();
  const token = headers.get("Authorization") ? null : session?.token;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  // Token caducado o revocado: se olvida la sesión para volver a entrar con Twitch
  if (response.status === 401 && token) {
    clearSession();
  }
  return response;
};

// Extrae el mensaje de error que devuelve la API ({ message } o texto plano)
export const readApiError = async (response: Response) => {
  const text = await response.text();
  try {
    const data: unknown = JSON.parse(text);
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as { message: unknown }).message;
      if (typeof message === "string") return message;
    }
  } catch {
    // No es JSON
  }
  return text || `Error ${response.status}`;
};

export const channelPath = (channelUsername: string) =>
  `/channels/${encodeURIComponent(channelUsername)}`;

export interface RatedMoviesQuery {
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: MovieSortKey;
  dir?: SortDirection;
  minRating?: string;
  maxRating?: string;
  // ISO 8601
  watchedFrom?: string;
  watchedTo?: string;
  minYear?: string;
  maxYear?: string;
  ids?: number[];
}

export interface MoviePage {
  items: FilmMetadataProps[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Películas o juegos puntuados de un canal. Búsqueda, filtros, orden y paginación los resuelve la API
export const fetchRatedMovies = async (
  channelUsername: string,
  query: RatedMoviesQuery = {},
  signal?: AbortSignal,
  mediaType: MediaType = "movie",
): Promise<MoviePage> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }

  const search = params.size ? `?${params.toString()}` : "";
  const response = await apiFetch(`${channelPath(channelUsername)}/${MEDIA_PATHS[mediaType].api}${search}`, { signal });
  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
  return (await response.json()) as MoviePage;
};
