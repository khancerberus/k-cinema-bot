import { useEffect, useState } from "react";
import { MovieStar, type MovieStarProps } from "./components/MovieStar";
import { NavBar } from "./components/NavBar";
import "./index.css";

function App() {
  const [movieData, setMovieData] = useState<MovieStarProps[]>([]);

  useEffect(() => {

    fetch("http://localhost:4000/star/movies")
      .then((response) => response.json())
      .then((data) => setMovieData(data))
      .catch((error) => console.error("Error fetching movie data:", error));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <header className="flex items-center justify-center p-5">
        <h1 className="text-8xl font-bold mb-4 font-bebaskai">Movie Stars</h1>
      </header>

      <div className="flex flex-col items-center gap-4 px-8">
        {movieData.map((movie, index) => (
          <MovieStar key={index} {...movie} />
        ))}
      </div>
    </div>
  );
}

export default App;
