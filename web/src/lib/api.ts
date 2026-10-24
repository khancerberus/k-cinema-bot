import type { FilmMetadataProps } from "../components/MovieRatingCard";
import { getSession } from "./session";

export const API_URL = import.meta.env.VITE_API_URL ?? "/api";

// fetch contra la API que añade la sesión provisional del streamer, si la hay
export const apiFetch = (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  const session = getSession();
  if (session) {
    headers.set("X-Channel-Session", session.channelId);
  }
  return fetch(`${API_URL}${path}`, { ...init, headers });
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

export const fetchRatedMovies = async (channelUsername: string): Promise<FilmMetadataProps[]> => {
  const response = await apiFetch(`${channelPath(channelUsername)}/movies`);
  if (!response.ok) {
    throw new Error(`Failed to fetch movies: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (Array.isArray(data)) {
    return data as FilmMetadataProps[];
  }

  console.error("Unexpected movie payload:", data);
  return [];
};
