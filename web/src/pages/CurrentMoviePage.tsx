import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch, channelPath, readApiError } from "../lib/api";
import { useChannel } from "../lib/channel-context";

interface CurrentMovie {
  tmdbId: number;
  title: string;
  releaseYear: string;
}

export const CurrentMoviePage = () => {
  const { channel, isOwner } = useChannel();
  const basePath = `${channelPath(channel.channelUsername)}/current-movie`;

  const [currentMovie, setCurrentMovie] = useState<CurrentMovie | null>(null);
  const [tmdbId, setTmdbId] = useState("");

  const loadCurrentMovie = useCallback(async (): Promise<CurrentMovie | null> => {
    const response = await apiFetch(basePath);
    return response.ok ? ((await response.json()) as CurrentMovie) : null;
  }, [basePath]);

  const fetchCurrentMovie = async () => {
    setCurrentMovie(await loadCurrentMovie());
  };

  useEffect(() => {
    if (!isOwner) return;

    let cancelled = false;
    loadCurrentMovie()
      .then((movie) => {
        if (!cancelled) setCurrentMovie(movie);
      })
      .catch((error) => console.error("Error:", error));

    return () => {
      cancelled = true;
    };
  }, [isOwner, loadCurrentMovie]);

  // Solo el streamer del canal (con sesión iniciada) puede gestionar la película
  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 px-4 py-10 text-center">
        <h1 className="text-8xl font-bold font-bebaskai">Current Movie</h1>
        <p className="text-xl text-gray-300">
          Solo el streamer de {channel.displayName} puede ver esta página.
        </p>
        <a href="/" className="text-[#00fff9] hover:underline">
          Entrar con tu canal
        </a>
      </div>
    );
  }

  const handleSetMovie = async () => {
    try {
      const response = await apiFetch(basePath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // announce: el bot avisa en el chat que ya se puede puntuar
        body: JSON.stringify({ tmdbId: Number(tmdbId), announce: true }),
      });

      if (!response.ok) {
        toast.error(await readApiError(response));
        return;
      }

      const message = await response.text();

      await fetchCurrentMovie();
      setTmdbId("");
      toast.success(message || "Current movie updated successfully!");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to update current movie.");
    }
  };

  const handleClearMovie = async () => {
    try {
      // announce=true: el bot publica en el chat el resumen de la votación
      const response = await apiFetch(`${basePath}?announce=true`, {
        method: "DELETE",
      });

      if (!response.ok) {
        toast.error(await readApiError(response));
        return;
      }

      const message = await response.text();

      setCurrentMovie(null);
      toast.success(message || "Current movie cleared successfully!");
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
