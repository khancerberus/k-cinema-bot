import { useState } from "react";
import { useLoaderData } from "react-router";
import { toast } from "sonner";

interface CurrentMovie {
  tmdbId: number;
  title: string;
  releaseYear: string;
}

export const CurrentMoviePage = () => {
  const loadedMovie = useLoaderData<CurrentMovie | null>();

  const [currentMovie, setCurrentMovie] = useState<CurrentMovie | null>(loadedMovie);
  const [tmdbId, setTmdbId] = useState("");

  const fetchCurrentMovie = async () => {
    const response = await fetch("http://localhost:4000/current-movie");
    if (!response.ok) {
      setCurrentMovie(null);
      return;
    }

    const movie = (await response.json()) as CurrentMovie;
    setCurrentMovie(movie);
  };

  const handleSetMovie = async () => {
    try {
      const response = await fetch("http://localhost:4000/current-movie/set", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channelUsername: "khancerberus", tmdbId: Number(tmdbId) }),
      });

      if (!response.ok) {
        throw new Error("Failed to set current movie");
      }

      await fetchCurrentMovie();
      setTmdbId("");
      toast.success("Current movie updated successfully!");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to update current movie.");
    }
  };

  const handleClearMovie = async () => {
    try {
      const response = await fetch("http://localhost:4000/current-movie", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear current movie");
      }

      setCurrentMovie(null);
      toast.success("Current movie cleared successfully!");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to clear current movie.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h1 className="text-8xl font-bold mb-4 font-bebaskai">Current Movie</h1>
      {!currentMovie ? (
        <p className="text-xl text-gray-300">No movie is currently being watched.</p>
      ) : (
        <p className="text-xl text-gray-300">
          Currently watching: {currentMovie.title} ({currentMovie.releaseYear})
        </p>
      )}

      <div className="flex flex-col items-center justify-center mt-8 p-6 border border-[#cf0060] rounded-lg">
        <h2 className="text-4xl font-bold mb-4">Set Movie</h2>
        <input
          className="mb-4 px-4 py-2 border border-gray-300 rounded w-full text-white bg-[#cf0060]/10"
          type="text"
          name="tmdbId"
          id="tmdbId"
          onChange={(event) => {
            setTmdbId(event.target.value);
          }}
          value={tmdbId}
        />
        <button
          className="px-4 py-2 bg-[#cf0060] text-white rounded hover:bg-[#ff2a4b] transition-colors cursor-pointer disabled:bg-gray-500 disabled:cursor-not-allowed"
          disabled={!tmdbId}
          onClick={handleSetMovie}
        >
          Set Current Movie
        </button>
      </div>

      <div className="flex flex-col items-center justify-center mt-8 p-6 border border-[#cf0060] rounded-lg">
        <h2 className="text-4xl font-bold mb-4">Clear Current Movie</h2>
        <button
          className="px-4 py-2 bg-[#cf0060] text-white rounded hover:bg-[#ff2a4b] transition-colors"
          onClick={handleClearMovie}
        >
          Clear Current Movie
        </button>
      </div>
    </div>
  );
};
