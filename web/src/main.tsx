import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import RatedMoviesPage, { RatedGamesPage } from "./pages/RatedMoviesPage";
import { MainLayout } from "./components/MainLayout"
import { ChannelLayout } from "./components/ChannelLayout"
import { MovieStarsPage } from "./pages/MovieStarsPage"
import { CurrentMoviePage } from "./pages/CurrentMoviePage"
import { HomePage } from "./pages/HomePage"
import { LoginPage } from "./pages/LoginPage"
import { ChannelNotFoundPage } from "./pages/ChannelNotFoundPage"
import { OverlayError, OverlayPage } from "./pages/OverlayPage"
import { RecommendationsPage } from "./pages/RecommendationsPage"
import { BotTokenPage } from "./pages/BotTokenPage"
import { apiFetch, channelPath } from "./lib/api";
import { MEDIA_PATHS, type MediaType } from "./types/channel.type";

// Detalle de una película o un juego con sus estrellas
const itemLoader =
  (mediaType: MediaType) =>
  async ({ params }: { params: Record<string, string | undefined> }) => {
    const response = await apiFetch(
      `${channelPath(params.channel ?? "")}/${MEDIA_PATHS[mediaType].api}/${params.tmdbId}`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch stars");
    }
    return response.json();
  };

// Perfil público del canal de la URL
const channelLoader = async ({ params }: { params: Record<string, string | undefined> }) => {
  const response = await apiFetch(channelPath(params.channel ?? ""));
  if (response.status === 404) {
    throw new Response("Channel not found", { status: 404 });
  }
  if (!response.ok) {
    throw new Error("Failed to fetch channel");
  }
  return response.json();
};

const router = createBrowserRouter([
  {
    // Fuente de navegador de OBS: sin layout, fondo transparente
    path: "/:channel/overlay",
    loader: channelLoader,
    Component: OverlayPage,
    ErrorBoundary: OverlayError,
  },
  {
    path: "/",
    Component: MainLayout,
    children: [
      {
        index: true,
        Component: LoginPage,
      },
      {
        // Generador de BOT_MOD_TOKEN (Twitch vuelve aquí con #access_token)
        path: "bot-token",
        Component: BotTokenPage,
      },
      {
        path: ":channel",
        loader: channelLoader,
        Component: ChannelLayout,
        ErrorBoundary: ChannelNotFoundPage,
        children: [
          {
            index: true,
            Component: HomePage,
          },
          {
            path: "recommendations",
            Component: RecommendationsPage,
          },
          {
            path: "rated-movies",
            Component: RatedMoviesPage,
          },
          {
            path: "rated-movies/movie/:tmdbId",
            loader: itemLoader("movie"),
            Component: MovieStarsPage,
          },
          {
            path: "rated-games",
            Component: RatedGamesPage,
          },
          {
            // :tmdbId es el ID de IGDB
            path: "rated-games/game/:tmdbId",
            loader: itemLoader("game"),
            Component: MovieStarsPage,
          },
          {
            path: "current-movie",
            Component: CurrentMoviePage,
          },
        ],
      },
    ],
  },
], {
  // Subruta del despliegue, definida con VITE_BASE_PATH
  basename: import.meta.env.BASE_URL,
});

const root = document.getElementById("root");

createRoot(root!).render(<RouterProvider router={router} />);
