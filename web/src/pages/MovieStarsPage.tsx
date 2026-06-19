import { useLoaderData } from "react-router";
import type { MovieDetails } from "../types/movie-star.type";

export const MovieStarsPage = () => {
  const movieDetails = useLoaderData<MovieDetails>();
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
    <div className="flex flex-col items-center gap-4 px-8 py-4 w-full xl:w-300 mx-auto">
      <header className="flex flex-col items-center justify-center p-5">
        <h1 className="text-8xl font-bold mb-4 font-bebaskai">Stars</h1>
      </header>

      <div className="flex flex-row w-full xl:w-300">
        <div className="flex-1 flex flex-row items-start gap-4">
          <div className="w-60 h-90 shrink-0">
            <img src={movieDetails.posterUrl} alt={movieDetails.title} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-4xl font-bold text-[#ff2a4b]">{movieDetails.title} ({movieDetails.year})</h2>
            <p>
              <span className="font-bold">Director:</span> {movieDetails.director}
            </p>
            <p>
              <span className="font-bold">Sinopsis:</span> {movieDetails.synopsis}
            </p>
          </div>
        </div>
        <div className="flex flex-col w-50 items-end justify-center text-right border-l border-white pl-4">
          <div className="flex flex-col text-center">
            <p className="text-md font-bold">Rating Promedio</p>
            <span className="text-4xl text-[#ffa300]">{movieDetails.rating}★</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 px-8 py-4 w-full xl:w-300 mx-auto">
        {sortedStarsByDate.map(([date, stars]) => (
          <section key={date} className="w-full p-4">
            <h3 className="text-2xl font-bold mb-3 text-cyan-300">{date}</h3>
            <div className="flex flex-col gap-2">
              {stars.map((star, index) => (
                <div
                  key={`${star.username}-${star.createdAt}-${index}`}
                  className="flex flex-row items-center justify-between gap-3 border border-cyan-500 rounded p-2"
                >
                  <p className="text-md font-bold">{star.username}</p>
                  <div className="text-md">{renderStars(star.score)}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
