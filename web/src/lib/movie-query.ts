// Estado de búsqueda, filtros, orden y página de Rated Movies. Vive en la URL (?q=&page=...)
// para poder compartir el enlace y usar "atrás"; la API hace todo el trabajo.

export type MovieSortKey = "title" | "rating" | "lastWatched" | "year";
export type SortDirection = "asc" | "desc";

export interface MovieSortValue {
  key: MovieSortKey;
  direction: SortDirection;
}

export interface MovieFilterValues {
  minRating: string;
  maxRating: string;
  // "YYYY-MM-DD" del input de fecha
  watchedFrom: string;
  watchedTo: string;
  minYear: string;
  maxYear: string;
}

export const defaultMovieSort: MovieSortValue = { key: "lastWatched", direction: "desc" };

export const emptyMovieFilters: MovieFilterValues = {
  minRating: "",
  maxRating: "",
  watchedFrom: "",
  watchedTo: "",
  minYear: "",
  maxYear: "",
};

const FILTER_KEYS = Object.keys(emptyMovieFilters) as Array<keyof MovieFilterValues>;
const SORT_KEYS: MovieSortKey[] = ["title", "rating", "lastWatched", "year"];

export interface RatedMoviesState {
  q: string;
  page: number;
  sort: MovieSortValue;
  filters: MovieFilterValues;
}

export const readRatedMoviesState = (params: URLSearchParams): RatedMoviesState => {
  const sortKey = params.get("sort") as MovieSortKey | null;
  const direction = params.get("dir");
  const page = Number(params.get("page"));

  return {
    q: params.get("q") ?? "",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    sort:
      sortKey && SORT_KEYS.includes(sortKey)
        ? { key: sortKey, direction: direction === "asc" ? "asc" : "desc" }
        : defaultMovieSort,
    filters: Object.fromEntries(
      FILTER_KEYS.map((key) => [key, params.get(key) ?? ""]),
    ) as unknown as MovieFilterValues,
  };
};

// Solo se escriben en la URL los valores distintos del valor por defecto
export const writeRatedMoviesState = (state: RatedMoviesState) => {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.sort.key !== defaultMovieSort.key || state.sort.direction !== defaultMovieSort.direction) {
    params.set("sort", state.sort.key);
    params.set("dir", state.sort.direction);
  }
  for (const key of FILTER_KEYS) {
    if (state.filters[key]) params.set(key, state.filters[key]);
  }
  return params;
};
