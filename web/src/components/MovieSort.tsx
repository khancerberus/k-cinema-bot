import {
  defaultMovieSort,
  type MovieSortKey,
  type MovieSortValue,
  type SortDirection,
} from "../lib/movie-query";
import type { MediaType, RatingCategory } from "../types/channel.type";

const sortOptions: Array<{ key: MovieSortKey; label: string; defaultDirection: SortDirection }> = [
  { key: "title", label: "Título", defaultDirection: "asc" },
  { key: "rating", label: "Rating promedio", defaultDirection: "desc" },
  { key: "lastWatched", label: "Última vez visto", defaultDirection: "desc" },
  { key: "year", label: "Año de la película", defaultDirection: "desc" },
];

interface MovieSortProps {
  sort: MovieSortValue;
  onChange: (sort: MovieSortValue) => void;
  // Categorías por las que también se puede ordenar (juegos)
  categories?: RatingCategory[];
  mediaType?: MediaType;
}

export const MovieSort = ({ sort, onChange, categories = [], mediaType = "movie" }: MovieSortProps) => {
  const options = [
    ...sortOptions.map((option) =>
      option.key === "year" && mediaType === "game" ? { ...option, label: "Año del juego" } : option,
    ),
    ...categories.map((category) => ({
      key: `cat:${category.key}` as MovieSortKey,
      label: category.label,
      defaultDirection: "desc" as SortDirection,
    })),
  ];
  // Al pulsar el criterio activo se invierte la dirección; uno nuevo empieza con su dirección por defecto
  const selectSort = (key: MovieSortKey, defaultDirection: SortDirection) => {
    if (sort.key === key) {
      onChange({ key, direction: sort.direction === "asc" ? "desc" : "asc" });
    } else {
      onChange({ key, direction: defaultDirection });
    }
  };

  return (
    <div className="flex flex-col gap-4 outline-2 outline-[#cf0060] rounded-xl p-4 w-full relative bg-[#cf0060]/10 shadow-md shadow-[#cf0060]/60">
      <div className="flex flex-row items-center justify-between gap-2">
        <h2 className="text-2xl font-bold text-[#ff2a4b]">Ordenar por</h2>
        <button
          className="border border-[#00fff9] text-[#00fff9] px-2 py-1 rounded opacity-90 hover:bg-[#00fff9]/10 transition-colors duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          onClick={() => onChange(defaultMovieSort)}
          disabled={
            sort.key === defaultMovieSort.key && sort.direction === defaultMovieSort.direction
          }
        >
          <p className="text-sm">Restablecer orden</p>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {options.map(({ key, label, defaultDirection }) => {
          const isActive = sort.key === key;

          return (
            <button
              key={key}
              className={`flex flex-row items-center justify-center gap-1 border px-3 py-2 rounded text-sm transition-colors duration-300 cursor-pointer ${
                isActive
                  ? "border-[#00fff9] bg-[#00fff9]/15 text-[#00fff9] font-bold"
                  : "border-[#cf0060]/60 text-gray-300 hover:border-[#00fff9] hover:text-[#00fff9]"
              }`}
              onClick={() => selectSort(key, defaultDirection)}
              aria-pressed={isActive}
              title={isActive ? "Invertir orden" : `Ordenar por ${label.toLowerCase()}`}
            >
              {label}
              {isActive && (
                <span aria-label={sort.direction === "asc" ? "ascendente" : "descendente"}>
                  {sort.direction === "asc" ? "↑" : "↓"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
