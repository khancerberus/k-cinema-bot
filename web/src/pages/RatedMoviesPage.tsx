import { useEffect, useState } from "react";
import { MovieRatingCard, type FilmMetadataProps } from "../components/MovieRatingCard";
import "../index.css";

function RatedMoviesPage() {
  const [movieData, setMovieData] = useState<FilmMetadataProps[]>([]);

  useEffect(() => {
    fetch("http://localhost:4000/star/movies")
      .then((response) => response.json())
      .then((data) => setMovieData(data))
      .catch((error) => console.error("Error fetching movie data:", error));
  }, []);

  return (
    <div>
      <header className="flex items-center justify-center p-5">
        <h1 className="text-8xl font-bold mb-4 font-bebaskai">Rated Movies</h1>
      </header>

      <div className="flex flex-col items-center gap-4 px-8 py-4 w-full xl:w-300 mx-auto">
        {movieData.map((movie, index) => (
          <MovieRatingCard key={index} {...movie} />
        ))}
      </div>
    </div>
  );
}

export default RatedMoviesPage;
