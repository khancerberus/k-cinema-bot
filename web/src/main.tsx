import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import RatedMoviesPage from "./pages/RatedMoviesPage";
import { MainLayout } from "./components/MainLayout"
import { ChannelLayout } from "./components/ChannelLayout"
import { MovieStarsPage } from "./pages/MovieStarsPage"
import { CurrentMoviePage } from "./pages/CurrentMoviePage"
import { HomePage } from "./pages/HomePage"
import { LoginPage } from "./pages/LoginPage"
import { ChannelNotFoundPage } from "./pages/ChannelNotFoundPage"
import { apiFetch, channelPath } from "./lib/api";

const router = createBrowserRouter([
  {
    path: "/",
    Component: MainLayout,
    children: [
      {
        index: true,
        Component: LoginPage,
      },
      {
        path: ":channel",
        loader: async ({ params }) => {
          const response = await apiFetch(channelPath(params.channel ?? ""));
          if (response.status === 404) {
            throw new Response("Channel not found", { status: 404 });
          }
          if (!response.ok) {
            throw new Error("Failed to fetch channel");
          }
          return response.json();
        },
        Component: ChannelLayout,
        ErrorBoundary: ChannelNotFoundPage,
        children: [
          {
            index: true,
            Component: HomePage,
          },
          {
            path: "rated-movies",
            Component: RatedMoviesPage,
          },
          {
            path: "rated-movies/movie/:tmdbId",
            loader: async ({ params }) => {
              const response = await apiFetch(
                `${channelPath(params.channel ?? "")}/movies/${params.tmdbId}`,
              );
              if (!response.ok) {
                throw new Error("Failed to fetch movie stars");
              }
              return response.json();
            },
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
]);

const root = document.getElementById("root");

createRoot(root!).render(<RouterProvider router={router} />);
