import type { FilmMetadataProps } from "./MovieRatingCard";

export interface MovieFilterValues {
  minRating: string;
  maxRating: string;
  watchedFrom: string;
  watchedTo: string;
  minYear: string;
  maxYear: string;
}

export const emptyMovieFilters: MovieFilterValues = {
  minRating: "",
  maxRating: "",
  watchedFrom: "",
  watchedTo: "",
  minYear: "",
  maxYear: "",
};

export const filterMovies = (
  movies: FilmMetadataProps[],
  filters: MovieFilterValues,
) => {
  // Los inputs de fecha devuelven "YYYY-MM-DD"; se comparan en hora local e incluyen el día completo
  const watchedFrom = filters.watchedFrom
    ? new Date(`${filters.watchedFrom}T00:00:00`).getTime()
    : null;
  const watchedTo = filters.watchedTo
    ? new Date(`${filters.watchedTo}T23:59:59.999`).getTime()
    : null;

  return movies.filter((movie) => {
    if (filters.minRating && movie.rating < Number(filters.minRating)) return false;
    if (filters.maxRating && movie.rating > Number(filters.maxRating)) return false;

    const lastWatched = Date.parse(movie.lastWatched);
    if (watchedFrom !== null && !(lastWatched >= watchedFrom)) return false;
    if (watchedTo !== null && !(lastWatched <= watchedTo)) return false;

    // Las películas con año "Unknown" quedan fuera si se filtra por año
    const year = Number(movie.year);
    if (filters.minYear && !(year >= Number(filters.minYear))) return false;
    if (filters.maxYear && !(year <= Number(filters.maxYear))) return false;

    return true;
  });
};

interface MovieFiltersProps {
  filters: MovieFilterValues;
  onChange: (filters: MovieFilterValues) => void;
  resultCount: number;
  totalCount: number;
}

const inputClassName =
  "w-full min-w-0 bg-[#000117] border border-[#cf0060]/60 rounded px-2 py-1 text-sm text-gray-300 focus:outline-none focus:border-[#00fff9] [color-scheme:dark]";

export const MovieFilters = ({
  filters,
  onChange,
  resultCount,
  totalCount,
}: MovieFiltersProps) => {
  const updateFilter = (key: keyof MovieFilterValues, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = Object.values(filters).some((value) => value !== "");

  return (
    <div className="flex flex-col gap-4 outline-2 outline-[#cf0060] rounded-xl p-4 w-full relative bg-[#cf0060]/10 shadow-md shadow-[#cf0060]/60">
      <div className="flex flex-row items-center justify-between gap-2">
        <h2 className="text-2xl font-bold text-[#ff2a4b]">Filtros</h2>
        <button
          className="border border-[#00fff9] text-[#00fff9] px-2 py-1 rounded opacity-90 hover:bg-[#00fff9]/10 transition-colors duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          onClick={() => onChange(emptyMovieFilters)}
          disabled={!hasActiveFilters}
        >
          <p className="text-sm">Limpiar filtros</p>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-md font-bold mb-2">
            Rating Promedio <span className="text-[#ffa300]">★</span>
          </legend>
          <div className="flex flex-row items-center gap-2">
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              placeholder="Mín"
              aria-label="Rating mínimo"
              className={inputClassName}
              value={filters.minRating}
              onChange={(e) => updateFilter("minRating", e.target.value)}
            />
            <span className="text-stone-500">—</span>
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              placeholder="Máx"
              aria-label="Rating máximo"
              className={inputClassName}
              value={filters.maxRating}
              onChange={(e) => updateFilter("maxRating", e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-md font-bold mb-2">Última vez visto</legend>
          <div className="flex flex-row items-center gap-2">
            <input
              type="date"
              aria-label="Visto desde"
              className={inputClassName}
              value={filters.watchedFrom}
              max={filters.watchedTo || undefined}
              onChange={(e) => updateFilter("watchedFrom", e.target.value)}
            />
            <span className="text-stone-500">—</span>
            <input
              type="date"
              aria-label="Visto hasta"
              className={inputClassName}
              value={filters.watchedTo}
              min={filters.watchedFrom || undefined}
              onChange={(e) => updateFilter("watchedTo", e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-md font-bold mb-2">Año de la película</legend>
          <div className="flex flex-row items-center gap-2">
            <input
              type="number"
              min={1880}
              step={1}
              placeholder="Desde"
              aria-label="Año desde"
              className={inputClassName}
              value={filters.minYear}
              onChange={(e) => updateFilter("minYear", e.target.value)}
            />
            <span className="text-stone-500">—</span>
            <input
              type="number"
              min={1880}
              step={1}
              placeholder="Hasta"
              aria-label="Año hasta"
              className={inputClassName}
              value={filters.maxYear}
              onChange={(e) => updateFilter("maxYear", e.target.value)}
            />
          </div>
        </fieldset>
      </div>

      <p className="text-sm text-[#00fff9] opacity-90">
        Mostrando <span className="font-bold">{resultCount}</span> de{" "}
        <span className="font-bold">{totalCount}</span> películas
      </p>
    </div>
  );
};
