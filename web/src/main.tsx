import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import RatedMoviesPage from "./pages/RatedMoviesPage";
import { MainLayout } from "./components/MainLayout"
import { MovieStarsPage } from "./pages/MovieStarsPage"
import { CurrentMoviePage } from "./pages/CurrentMoviePage"

const router = createBrowserRouter([
  {
    path: "/",
    Component: MainLayout,
    children: [
      {
        path: "/rated-movies",
        Component: RatedMoviesPage,
      },
      {
        path: "/rated-movies/movie/:tmdbId",
        loader: async ({ params }) => {
          const response = await fetch(`http://localhost:4000/star/movie/${params.tmdbId}`);
          if (!response.ok) {
            throw new Error("Failed to fetch movie stars");
          }
          return response.json();
        },
        Component: MovieStarsPage,
      },
      {
        path: '/current-movie',
        loader: async () => {
          const response = await fetch('http://localhost:4000/current-movie');
          if (!response.ok) {
            return null;
          }
          return response.json();
        },
        Component: CurrentMoviePage,
      }
    ],
  },
]);

const root = document.getElementById("root");

createRoot(root!).render(<RouterProvider router={router} />);
