import { Link } from "react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FilmMetadataProps } from "./MovieRatingCard";
import { MoviePoster } from "./MoviePoster";
import { MEDIA_LABELS, itemPath, type MediaType } from "../types/channel.type";

interface RecentMoviesCarouselProps {
  channelUsername: string;
  title: string;
  movies: FilmMetadataProps[];
  mediaType?: MediaType;
}

const arrowClassName =
  "flex items-center justify-center w-10 h-10 rounded-full border border-[#00fff9] text-[#00fff9] text-xl hover:bg-[#00fff9]/10 transition-colors duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent";

export const RecentMoviesCarousel = ({
  channelUsername,
  title,
  movies,
  mediaType = "movie",
}: RecentMoviesCarouselProps) => {
  const { plural } = MEDIA_LABELS[mediaType];
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    setCanScrollLeft(track.scrollLeft > 0);
    setCanScrollRight(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [movies, updateArrows]);

  const scroll = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;

    track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-3 outline-2 outline-[#cf0060] rounded-xl p-4 w-full bg-[#cf0060]/10 shadow-md shadow-[#cf0060]/60">
      <div className="flex flex-row items-end justify-between gap-2">
        <div>
          <h2 className="text-5xl font-bebaskai text-[#00fff9]">{title}</h2>
          <p className="text-sm text-stone-500">{mediaType === "game" ? `Los ${movies.length} ${plural} jugados` : `Las ${movies.length} ${plural} vistas`} más recientemente</p>
        </div>

        <div className="flex flex-row gap-2">
          <button
            className={arrowClassName}
            onClick={() => scroll(-1)}
            disabled={!canScrollLeft}
            aria-label="Anterior"
          >
            ‹
          </button>
          <button
            className={arrowClassName}
            onClick={() => scroll(1)}
            disabled={!canScrollRight}
            aria-label="Siguiente"
          >
            ›
          </button>
        </div>
      </div>

      {movies.length === 0 ? (
        <p className="text-stone-500 py-6 text-center">Todavía no hay {plural} puntuad{mediaType === "game" ? "os" : "as"}.</p>
      ) : (
        <div
          ref={trackRef}
          onScroll={updateArrows}
          className="flex flex-row gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {movies.map((movie) => (
            <Link
              key={movie.tmdbId}
              to={itemPath(channelUsername, movie.mediaType, movie.tmdbId)}
              className="group flex flex-col gap-2 w-40 shrink-0 snap-start"
            >
              <div className="relative w-40 h-60 rounded-lg overflow-hidden outline-1 outline-[#cf0060]/60 group-hover:outline-2 group-hover:outline-[#00fff9] transition-all duration-300">
                <MoviePoster
                  posterUrl={movie.posterUrl}
                  title={movie.title}
                  year={movie.year}
                  className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute top-2 right-2 rounded bg-[#000117]/85 px-2 py-0.5 text-sm font-bold text-[#ffa300]">
                  {movie.rating}★
                </span>
              </div>

              <div className="flex flex-col">
                <p className="font-bold text-sm text-[#ff2a4b] line-clamp-2">
                  {movie.title} ({movie.year})
                </p>
                <p className="text-xs text-[#00fff9] opacity-90">
                  {new Date(movie.lastWatched).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
