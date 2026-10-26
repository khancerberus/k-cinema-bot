import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { MovieRatingCard } from "../components/MovieRatingCard";
import { MovieFilters } from "../components/MovieFilters";
import { MovieSort } from "../components/MovieSort";
import { Pagination } from "../components/Pagination";
import { fetchRatedMovies, type MoviePage } from "../lib/api";
import { useChannel } from "../lib/channel-context";
import {
  readRatedMoviesState,
  writeRatedMoviesState,
  type MovieFilterValues,
  type MovieSortValue,
  type RatedMoviesState,
} from "../lib/movie-query";
import { MEDIA_LABELS, type MediaType } from "../types/channel.type";
import "../index.css";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
// Pequeña espera antes de pedir a la API, para no lanzar una petición por cada tecla en los filtros
const FETCH_DEBOUNCE_MS = 150;

// Fechas "YYYY-MM-DD" del input → ISO en hora local, incluyendo el día completo
const startOfDay = (date: string) => (date ? new Date(`${date}T00:00:00`).toISOString() : undefined);
const endOfDay = (date: string) => (date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined);

const inputClassName =
  "w-full bg-[#000117] border border-[#cf0060]/60 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-[#00fff9]";

const PAGE_TITLES: Record<MediaType, string> = { movie: "Rated Movies", game: "Rated Games" };

// Lista de películas o juegos puntuados de un canal
export function RatedItemsPage({ mediaType }: { mediaType: MediaType }) {
  const { channel } = useChannel();
  const labels = MEDIA_LABELS[mediaType];
  // Juegos: también se puede ordenar por el promedio de cada categoría activa
  const sortCategories = channel.settings.rating.categories[mediaType].filter((category) => !category.archived);
  const [searchParams, setSearchParams] = useSearchParams();
  const state = readRatedMoviesState(searchParams);
  const requestKey = `${channel.channelUsername}?${searchParams.toString()}`;

  const [result, setResult] = useState<{ key: string; data: MoviePage | null; error: boolean }>({
    key: "",
    data: null,
    error: false,
  });
  const loading = result.key !== requestKey;

  // El texto se escribe en la URL con un pequeño retraso; si la URL cambia por "atrás", se sincroniza
  const [searchText, setSearchText] = useState(state.q);
  const [lastUrlQuery, setLastUrlQuery] = useState(state.q);
  if (state.q !== lastUrlQuery) {
    setLastUrlQuery(state.q);
    setSearchText(state.q);
  }

  // Cambiar búsqueda, filtros u orden vuelve a la página 1
  const update = (changes: Partial<RatedMoviesState>, push = false) => {
    setSearchParams(writeRatedMoviesState({ ...state, page: 1, ...changes }), { replace: !push });
  };

  useEffect(() => {
    const q = searchText.trim();
    if (q === state.q) return;
    const timer = setTimeout(() => {
      // Se marca como propio para que la sincronización de arriba no pise lo que se sigue escribiendo
      setLastUrlQuery(q);
      update({ q });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  });

  useEffect(() => {
    const controller = new AbortController();
    const { q, page, sort, filters } = readRatedMoviesState(searchParams);

    const timer = setTimeout(() => {
      fetchRatedMovies(
        channel.channelUsername,
        {
          q,
          page,
          pageSize: PAGE_SIZE,
          sort: sort.key,
          dir: sort.direction,
          minRating: filters.minRating,
          maxRating: filters.maxRating,
          watchedFrom: startOfDay(filters.watchedFrom),
          watchedTo: endOfDay(filters.watchedTo),
          minYear: filters.minYear,
          maxYear: filters.maxYear,
        },
        controller.signal,
        mediaType,
      )
        .then((data) => setResult({ key: requestKey, data, error: false }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          console.error("Error fetching movie data:", error);
          setResult({ key: requestKey, data: null, error: true });
        });
    }, FETCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [channel.channelUsername, searchParams, requestKey, mediaType]);

  const changePage = (page: number) => {
    update({ page }, true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const movies = result.data?.items ?? [];
  const hasFilters = Boolean(state.q) || Object.values(state.filters).some(Boolean);

  return (
    <div>
      <header className="flex items-center justify-center p-5">
        <h1 className="text-8xl font-bold mb-4 font-bebaskai">{PAGE_TITLES[mediaType]}</h1>
      </header>

      <div className="flex flex-col items-center gap-4 px-8 py-4 w-full xl:w-300 mx-auto">
        <input
          type="search"
          className={inputClassName}
          placeholder={`Buscar por título, ${labels.creator.toLowerCase()} o año...`}
          aria-label={`Buscar ${labels.plural}`}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          maxLength={100}
        />

        <MovieFilters
          filters={state.filters}
          onChange={(filters: MovieFilterValues) => update({ filters })}
          resultCount={loading ? null : (result.data?.total ?? 0)}
          mediaType={mediaType}
        />

        <MovieSort
          sort={state.sort}
          onChange={(sort: MovieSortValue) => update({ sort })}
          categories={sortCategories}
          mediaType={mediaType}
        />

        <div className={`flex flex-col gap-4 w-full transition-opacity ${loading ? "opacity-50" : ""}`}>
          {movies.map((movie) => (
            <MovieRatingCard key={movie.tmdbId} channelUsername={channel.channelUsername} {...movie} />
          ))}
        </div>

        {!loading && result.error && (
          <p className="text-stone-500 py-8">No se pudieron cargar {labels.plural === "juegos" ? "los" : "las"} {labels.plural}. Inténtalo de nuevo.</p>
        )}

        {!loading && !result.error && movies.length === 0 && (
          <p className="text-stone-500 py-8">
            {hasFilters
              ? `Ningún resultado coincide con la búsqueda.`
              : `Este canal aún no tiene ${labels.plural} puntuad${mediaType === "game" ? "os" : "as"}.`}
          </p>
        )}

        <Pagination
          page={state.page}
          totalPages={result.data?.totalPages ?? 0}
          onChange={changePage}
        />
      </div>
    </div>
  );
}

function RatedMoviesPage() {
  return <RatedItemsPage mediaType="movie" />;
}

export function RatedGamesPage() {
  return <RatedItemsPage mediaType="game" />;
}

export default RatedMoviesPage;
