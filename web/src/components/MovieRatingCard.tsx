import { useState } from "react";

export interface FilmMetadataProps {
  tmdbId: number;
  title: string;
  year: string;
  director: string;
  synopsis: string;
  rating: number;
  lastWatched: string;
  posterUrl: string;
}

export const MovieRatingCard = ({
  tmdbId,
  title,
  year,
  director,
  synopsis,
  rating,
  lastWatched,
  posterUrl,
}: FilmMetadataProps) => {
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
            href={`https://www.themoviedb.org/movie/${tmdbId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="font-bold">TMDB ID:</span> {tmdbId}
          </a>
          <h2 className="text-2xl font-bold text-[#ff2a4b]">
            {title} ({year})
          </h2>

          <p>
            <span className="font-bold">Director:</span> {director}
          </p>
          <p
            className={`text-sm text-gray-300 cursor-pointer ${isSynopsisExpanded ? "" : "text-ellipsis overflow-hidden max-h-12"}`}
            onClick={toggleSynopsis}
          >
            <span className="font-bold">Sinopsis:</span> {synopsis}
          </p>
        </div>
      </div>

      <div className="flex flex-col text-lg h-42 justify-center text-right">
        <div className="flex flex-col text-center ">
          <p className="text-md font-bold">Rating Promedio</p>
          <span className="text-4xl text-[#ffa300]">{rating}★</span>
        </div>

        <div className="text-sm text-[#00fff9] opacity-90 ">
          <p>
            <span className="font-bold">Ultima vez visto:</span> {lastWatched}
          </p>
        </div>
      </div>

      <a
        className="absolute top-1 right-2 border border-[#00fff9] text-[#00fff9] px-2 py-1 rounded opacity-90 hover:bg-[#00fff9]/10 transition-colors duration-300"
        href={`/rated-movies/movie/${tmdbId}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <p className="text-sm">Ver rating</p>
      </a>
    </div>
  );
};
