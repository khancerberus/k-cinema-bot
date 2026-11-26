import { useEffect, useState } from "react";
import { MoviePoster } from "../components/MoviePoster";
import { fetchRecommendations } from "../lib/api";
import type { RecommendationItem } from "../types/recommendation.type";
import "../index.css";

// Prototipo: lista de recomendaciones de la lista de TMDB con quién recomendó cada una
export function RecommendationsPage() {
  const [items, setItems] = useState<RecommendationItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchRecommendations(controller.signal)
      .then(setItems)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Error fetching recommendations:", err);
        setError(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <div>
      <header className="flex flex-col items-center justify-center p-5">
        <h1 className="text-8xl font-bold mb-2 font-bebaskai">Recomendaciones</h1>
        {items && <p className="text-stone-400">{items.length} recomendaciones</p>}
      </header>

      <div className="px-8 py-4 w-full xl:w-300 mx-auto">
        {!items && !error && <p className="text-stone-500 py-8 text-center">Cargando...</p>}

        {error && (
          <p className="text-stone-500 py-8 text-center">
            No se pudieron cargar las recomendaciones. Inténtalo de nuevo.
          </p>
        )}

        {items && items.length === 0 && (
          <p className="text-stone-500 py-8 text-center">Aún no hay recomendaciones.</p>
        )}

        {items && items.length > 0 && (
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {items.map((item) => (
              <li key={`${item.mediaType}-${item.tmdbId}`} className="flex flex-col gap-1">
                <MoviePoster
                  posterUrl={item.posterUrl ?? ""}
                  title={item.title}
                  year={item.year ?? ""}
                  className="w-full aspect-2/3 rounded"
                />
                <p className="font-semibold leading-tight">
                  {item.title}
                  {item.year && <span className="text-stone-400 font-normal"> ({item.year})</span>}
                </p>
                <p className="text-sm text-stone-400">
                  Recomendada por:{" "}
                  <span className={item.recommendedBy ? "text-[#00fff9]" : "text-stone-500 italic"}>
                    {item.recommendedBy ?? "Desconocido"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
