import type { FilmMetadataProps } from "../components/MovieRatingCard";
import { clearSession, getSession } from "./session";

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
