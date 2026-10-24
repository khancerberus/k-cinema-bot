import { useEffect, useMemo, useState } from "react";
import { MovieRatingCard, type FilmMetadataProps } from "../components/MovieRatingCard";
import {
  MovieFilters,
  emptyMovieFilters,
  filterMovies,
  type MovieFilterValues,
} from "../components/MovieFilters";
import {
  MovieSort,
  defaultMovieSort,
  sortMovies,
  type MovieSortValue,
} from "../components/MovieSort";
import { fetchRatedMovies } from "../lib/api";
import { useChannel } from "../lib/channel-context";
import "../index.css";

function RatedMoviesPage() {
  const { channel } = useChannel();
  const [movieData, setMovieData] = useState<FilmMetadataProps[]>([]);
  const [filters, setFilters] = useState<MovieFilterValues>(emptyMovieFilters);
  const [sort, setSort] = useState<MovieSortValue>(defaultMovieSort);

  const filteredMovies = useMemo(
    () => sortMovies(filterMovies(movieData, filters), sort),
    [movieData, filters, sort],
  );

  useEffect(() => {
    fetchRatedMovies(channel.channelUsername)
      .then((movies) => setMovieData(movies))
      .catch((error) => console.error("Error fetching movie data:", error));
  }, [channel.channelUsername]);

  return (
    <div>
      <header className="flex items-center justify-center p-5">
        <h1 className="text-8xl font-bold mb-4 font-bebaskai">Rated Movies</h1>
      </header>

      <div className="flex flex-col items-center gap-4 px-8 py-4 w-full xl:w-300 mx-auto">
        <MovieFilters
          filters={filters}
          onChange={setFilters}
          resultCount={filteredMovies.length}
          totalCount={movieData.length}
        />

        <MovieSort sort={sort} onChange={setSort} />

        {filteredMovies.map((movie) => (
          <MovieRatingCard key={movie.tmdbId} channelUsername={channel.channelUsername} {...movie} />
        ))}

        {movieData.length > 0 && filteredMovies.length === 0 && (
          <p className="text-stone-500 py-8">
            Ninguna película coincide con los filtros.
          </p>
        )}
      </div>
    </div>
  );
}

export default RatedMoviesPage;
