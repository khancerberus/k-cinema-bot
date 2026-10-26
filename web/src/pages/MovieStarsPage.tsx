import { useLoaderData } from "react-router";
import type { MovieDetails } from "../types/movie-star.type";
import { MEDIA_LABELS, SOURCE_LABELS } from "../types/channel.type";
import { MoviePoster } from "../components/MoviePoster";
import { RatingRadar } from "../components/RatingRadar";
import { CategoryBars } from "../components/CategoryBars";

const chipClassName = "border border-[#00fff9]/40 text-[#00fff9] rounded px-2 py-0.5 text-xs";

export const MovieStarsPage = () => {
  const movieDetails = useLoaderData<MovieDetails>();
  const labels = MEDIA_LABELS[movieDetails.mediaType];
  const categoryLabel = new Map(movieDetails.categories.map((category) => [category.key, category.label]));

  const renderStars = (score: number) => {
    const maxStars = 5;
    const starPath = "M12 17.27L18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21z";

    return (
      <span className="flex items-center gap-0.5" aria-label={`${score} de ${maxStars} estrellas`}>
        {Array.from({ length: maxStars }, (_, index) => {
          const fillRatio = Math.max(0, Math.min(1, score - index));

          return (
            <span key={`star-${index}`} className="relative block h-5 w-5">
              <svg
                viewBox="0 0 24 24"
                className="absolute inset-0 h-5 w-5 text-gray-500"
                aria-hidden="true"
              >
                <path d={starPath} fill="currentColor" />
              </svg>
              <span
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fillRatio * 100}%` }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-yellow-400"
                  aria-hidden="true"
                >
                  <path d={starPath} fill="currentColor" />
                </svg>
              </span>
            </span>
          );
        })}
      </span>
    );
  };

  // Desglose de un voto en el orden de las categorías del contenido
  const breakdownOf = (scores: Record<string, number>) =>
    movieDetails.categories
      .filter((category) => scores[category.key] !== undefined)
      .map((category) => `${categoryLabel.get(category.key)} ${scores[category.key]}`)
      .join(" · ");

  const starsByDate = movieDetails.stars.reduce<Record<string, MovieDetails['stars']>>(
    (acc, star) => {
      const dateKey = new Date(star.createdAt).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });

      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }

      acc[dateKey].push(star);
      return acc;
    },
    {},
  );
  const sortedStarsByDate = Object.entries(starsByDate).sort(([dateA], [dateB]) => {
    const [dayA, monthA, yearA] = dateA.split('/').map(Number);
    const [dayB, monthB, yearB] = dateB.split('/').map(Number);

    const parsedDateA = new Date(2000 + yearA, monthA - 1, dayA).getTime();
    const parsedDateB = new Date(2000 + yearB, monthB - 1, dayB).getTime();

    return parsedDateB - parsedDateA;
  });

  return (
    <div className="flex flex-col items-center gap-4 px-4 md:px-8 py-4 w-full xl:w-300 mx-auto">
      <header className="flex flex-col items-center justify-center p-5">
        <h1 className="text-8xl font-bold mb-4 font-bebaskai">Stars</h1>
      </header>

      <div className="flex flex-col md:flex-row gap-4 w-full xl:w-300">
        <div className="flex-1 flex flex-col sm:flex-row items-start gap-4">
          <MoviePoster
            posterUrl={movieDetails.posterUrl}
            title={movieDetails.title}
            year={movieDetails.year}
            className="w-60 h-90 shrink-0 rounded"
          />
          <div className="flex flex-col gap-2">
            {movieDetails.sourceUrl && (
              <a
                className="text-stone-500 text-sm"
                href={movieDetails.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="font-bold">{SOURCE_LABELS[movieDetails.mediaType]}:</span> {movieDetails.tmdbId}
              </a>
            )}
            <h2 className="text-4xl font-bold text-[#ff2a4b]">{movieDetails.title} ({movieDetails.year})</h2>
            {movieDetails.earlyAccessYear && (
              <p className="text-sm text-stone-400">
                Acceso anticipado desde {movieDetails.earlyAccessYear} · versión 1.0 en {movieDetails.year}
              </p>
            )}
            <p>
              <span className="font-bold">{labels.creator}:</span> {movieDetails.director}
            </p>
            {movieDetails.genres.length > 0 && (
              <div className="flex flex-wrap gap-1" aria-label="Géneros">
                {movieDetails.genres.map((genre) => (
                  <span key={genre} className={chipClassName}>{genre}</span>
                ))}
              </div>
            )}
            {movieDetails.platforms.length > 0 && (
              <p className="text-sm text-gray-400">
                <span className="font-bold text-gray-300">Plataformas:</span> {movieDetails.platforms.join(", ")}
              </p>
            )}
            <p>
              <span className="font-bold">{movieDetails.mediaType === "game" ? "Resumen" : "Sinopsis"}:</span>{" "}
              {movieDetails.synopsis}
            </p>
          </div>
        </div>
        <div className="flex flex-col md:w-50 items-center md:items-end justify-center text-right md:border-l border-white md:pl-4">
          <div className="flex flex-col text-center">
            <p className="text-md font-bold">Rating Promedio</p>
            <span className="text-4xl text-[#ffa300]">{movieDetails.rating}★</span>
            <span className="text-xs text-stone-500">
              {movieDetails.stars.length} {movieDetails.stars.length === 1 ? "voto" : "votos"}
            </span>
          </div>
        </div>
      </div>

      {movieDetails.categories.length > 0 && (
        <section className="flex flex-col md:flex-row items-center gap-8 w-full outline-2 outline-[#cf0060] rounded-xl p-4 bg-[#cf0060]/10">
          <div className="flex flex-col gap-1 self-stretch md:w-64">
            <h3 className="text-2xl font-bold text-cyan-300">Por categoría</h3>
            <p className="text-xs text-stone-500 mb-2">Promedio de todos los votos, sobre 5</p>
            <CategoryBars categories={movieDetails.categories} />
          </div>
          <div className="flex flex-1 justify-center">
            <RatingRadar categories={movieDetails.categories} />
          </div>
        </section>
      )}

      <div className="flex flex-col items-center gap-4 px-8 py-4 w-full xl:w-300 mx-auto">
        {sortedStarsByDate.map(([date, stars]) => (
          <section key={date} className="w-full p-4">
            <h3 className="text-2xl font-bold mb-3 text-cyan-300">{date}</h3>
            <div className="flex flex-col gap-2">
              {stars.map((star, index) => {
                const breakdown = breakdownOf(star.scores ?? {});
                return (
                  <div
                    key={`${star.username}-${star.createdAt}-${index}`}
                    className="flex flex-row flex-wrap items-center justify-between gap-3 border border-cyan-500 rounded p-2"
                  >
                    <div className="flex flex-col">
                      <p className="text-md font-bold">{star.username}</p>
                      {breakdown && <p className="text-xs text-gray-400">{breakdown}</p>}
                    </div>
                    <div className="flex items-center gap-2 text-md">
                      {renderStars(star.score)}
                      <span className="text-sm text-gray-300 tabular-nums">{star.score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
