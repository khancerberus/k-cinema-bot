import { Link } from "react-router";
import { useState } from "react";
import { MEDIA_LABELS, SOURCE_LABELS, itemPath, type MediaType } from "../types/channel.type";
import type { CategoryAverage } from "../types/movie-star.type";
import { CategoryBars } from "./CategoryBars";

export interface FilmMetadataProps {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  year: string;
  director: string;
  synopsis: string;
  rating: number;
  lastWatched: string;
  posterUrl: string;
  sourceUrl: string | null;
  // Promedio por categoría (vacío si se puntúa con una sola nota)
  categories: CategoryAverage[];
}

interface MovieRatingCardProps extends FilmMetadataProps {
  channelUsername: string;
}

export const MovieRatingCard = ({
  channelUsername,
  mediaType,
  tmdbId,
  title,
  year,
  director,
  synopsis,
  rating,
  lastWatched,
  posterUrl,
  sourceUrl,
  categories,
}: MovieRatingCardProps) => {
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);

  const toggleSynopsis = () => {
    setIsSynopsisExpanded((prev) => !prev);
  };

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 outline-2 outline-[#cf0060] rounded-xl p-2 w-full min-h-42 relative bg-[#cf0060]/10 shadow-md shadow-[#cf0060]/60">
      <div className="w-24 h-36 shrink-0">
        <img src={posterUrl} alt={title + " (" + year + ") poster"} />
      </div>

      <div className="flex-1 flex flex-col gap-2 h-full justify-between items-start">
        <div className="flex flex-col gap-1">
          <a
            className="text-stone-500 text-sm"
            href={sourceUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="font-bold">{SOURCE_LABELS[mediaType]}:</span> {tmdbId}
          </a>
          <h2 className="text-2xl font-bold text-[#ff2a4b]">
            {title} ({year})
          </h2>

          <p>
            <span className="font-bold">{MEDIA_LABELS[mediaType].creator}:</span> {director}
          </p>
          <p
            className={`text-sm text-gray-300 cursor-pointer ${isSynopsisExpanded ? "" : "text-ellipsis overflow-hidden max-h-12"}`}
            onClick={toggleSynopsis}
          >
            <span className="font-bold">{mediaType === "game" ? "Resumen" : "Sinopsis"}:</span> {synopsis}
          </p>
          {categories.length > 0 && (
            <div className="max-w-sm w-full mt-1">
              <CategoryBars categories={categories} compact />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col text-lg h-42 justify-center text-right">
        <div className="flex flex-col text-center ">
          <p className="text-md font-bold">Rating Promedio</p>
          <span className="text-4xl text-[#ffa300]">{rating}★</span>
        </div>

        <div className="text-sm text-[#00fff9] opacity-90 ">
          <p>
            <span className="font-bold">{mediaType === "game" ? "Última vez jugado" : "Ultima vez visto"}:</span> {new Date(lastWatched).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
            })}
          </p>
        </div>
      </div>

      <Link
        className="absolute top-1 right-2 border border-[#00fff9] text-[#00fff9] px-2 py-1 rounded opacity-90 hover:bg-[#00fff9]/10 transition-colors duration-300"
        to={itemPath(channelUsername, mediaType, tmdbId)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <p className="text-sm">Ver rating</p>
      </Link>
    </div>
  );
};
