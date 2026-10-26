import { Link } from "react-router";
import type { FilmMetadataProps } from "./MovieRatingCard";
import { MoviePoster } from "./MoviePoster";
import { MEDIA_LABELS, itemPath, type MediaType } from "../types/channel.type";

interface TopMoviesCardProps {
  channelUsername: string;
  title: string;
  subtitle: string;
  movies: FilmMetadataProps[];
  accentColor: string;
  // Solo en modo edición: muestra el botón para ocultar la película de los tops
  onHide?: (tmdbId: number) => void;
  mediaType?: MediaType;
}

export const TopMoviesCard = ({
  channelUsername,
  title,
  subtitle,
  movies,
  accentColor,
  onHide,
  mediaType = "movie",
}: TopMoviesCardProps) => {
  const { plural } = MEDIA_LABELS[mediaType];
  return (
    <div className="flex flex-col gap-3 outline-2 outline-[#cf0060] rounded-xl p-4 w-full bg-[#cf0060]/10 shadow-md shadow-[#cf0060]/60">
      <div>
        <h2 className="text-5xl font-bebaskai" style={{ color: accentColor }}>
          {title}
        </h2>
        <p className="text-sm text-stone-500">{subtitle}</p>
      </div>

      {movies.length === 0 ? (
        <p className="text-stone-500 py-6 text-center">Todavía no hay {plural} puntuad{mediaType === "game" ? "os" : "as"}.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {movies.map((movie, index) => (
            <li key={movie.tmdbId} className="flex flex-row items-center gap-2">
              <Link
                className="flex flex-1 min-w-0 flex-row items-center gap-3 rounded-lg p-2 border border-transparent hover:border-[#00fff9]/60 hover:bg-[#00fff9]/5 transition-colors duration-300"
                to={itemPath(channelUsername, movie.mediaType, movie.tmdbId)}
              >
                <span
                  className="w-8 shrink-0 text-center text-4xl font-bebaskai"
                  style={{ color: accentColor }}
                >
                  {index + 1}
                </span>

                <MoviePoster
                  posterUrl={movie.posterUrl}
                  title={movie.title}
                  year={movie.year}
                  className="w-12 h-18 shrink-0 rounded"
                />

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#ff2a4b] truncate">
                    {movie.title} ({movie.year})
                  </p>
                  <p className="text-sm text-gray-400 truncate">{movie.director}</p>
                </div>

                <span className="shrink-0 text-2xl text-[#ffa300]">{movie.rating}★</span>
              </Link>

              {onHide && (
                <button
                  className="shrink-0 border border-[#cf0060]/60 text-gray-300 px-2 py-1 rounded text-xs hover:border-[#00fff9] hover:text-[#00fff9] transition-colors duration-300 cursor-pointer"
                  onClick={() => onHide(movie.tmdbId)}
                  title="Ocultar de los tops"
                >
                  Ocultar
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
