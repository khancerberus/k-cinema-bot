import { Link } from "react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch, channelPath, readApiError } from "../lib/api";
import { useChannel } from "../lib/channel-context";
import { MoviePoster } from "../components/MoviePoster";
import {
  MAX_VOTING_MINUTES,
  MEDIA_LABELS,
  MIN_VOTING_MINUTES,
  type MediaType,
} from "../types/channel.type";

// Votación abierta (GET /current-movie)
interface CurrentItem {
  mediaType: MediaType;
  itemId: number;
  title: string;
  releaseYear: string;
  posterUrl: string | null;
  categories: Array<{ key: string; label: string }>;
  closesAt: string | null;
  votes: number;
}

// Resultado del buscador (GET /current-movie/search)
interface SearchResult {
  mediaType: MediaType;
  id: number;
  title: string;
  year: number | null;
  creator: string;
  posterUrl: string | null;
  platforms?: string[];
}

const SEARCH_DEBOUNCE_MS = 400;
const REFRESH_MS = 15_000;

const inputClassName =
  "w-full bg-[#000117] border border-[#cf0060]/60 rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-[#00fff9]";
const buttonClassName =
  "px-4 py-2 bg-[#cf0060] text-white rounded hover:bg-[#ff2a4b] transition-colors cursor-pointer disabled:bg-gray-500 disabled:cursor-not-allowed";
const secondaryButtonClassName =
  "px-3 py-2 border border-[#00fff9] text-[#00fff9] rounded hover:bg-[#00fff9]/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

const formatRemaining = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const CurrentMoviePage = () => {
  const { channel, isOwner } = useChannel();
  const basePath = `${channelPath(channel.channelUsername)}/current-movie`;

  const [current, setCurrent] = useState<CurrentItem | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>("game");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ key: string; items: SearchResult[] }>({ key: "", items: [] });
  const [minutes, setMinutes] = useState(channel.settings.voting.defaultMinutes);
  const [announce, setAnnounce] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const searchKey = `${mediaType}:${query.trim()}`;
  const searching = query.trim() !== "" && results.key !== searchKey;

  const loadCurrent = useCallback(async (): Promise<CurrentItem | null> => {
    const response = await apiFetch(basePath);
    return response.ok ? ((await response.json()) as CurrentItem) : null;
  }, [basePath]);

  const refresh = useCallback(() => {
    loadCurrent()
      .then(setCurrent)
      .catch((error) => console.error("Error:", error));
  }, [loadCurrent]);

  // Votación abierta: al entrar y cada poco (votos y cierre automático)
  useEffect(() => {
    if (!isOwner) return;
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [isOwner, refresh]);

  // Cuenta atrás
  useEffect(() => {
    if (!current?.closesAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [current?.closesAt]);

  // Búsqueda con un pequeño retraso mientras se escribe
  useEffect(() => {
    const text = query.trim();
    if (!isOwner || !text) return;
    const controller = new AbortController();
    const key = `${mediaType}:${text}`;

    const timer = setTimeout(() => {
      const params = new URLSearchParams({ type: mediaType, q: text });
      apiFetch(`${basePath}/search?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => (response.ok ? ((await response.json()) as SearchResult[]) : []))
        .then((items) => setResults({ key, items }))
        .catch((error: unknown) => {
          if (!controller.signal.aborted) console.error("Error:", error);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOwner, basePath, mediaType, query]);

  // Solo el streamer del canal (con sesión iniciada) puede gestionar la votación
  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 px-4 py-10 text-center">
        <h1 className="text-8xl font-bold font-bebaskai">Votación</h1>
        <p className="text-xl text-gray-300">
          Solo el streamer de {channel.displayName} puede ver esta página.
        </p>
        <Link to="/" className="text-[#00fff9] hover:underline">
          Entrar con tu canal
        </Link>
      </div>
    );
  }

  const send = async (path: string, init: RequestInit, onDone?: () => void) => {
    setBusy(true);
    try {
      const response = await apiFetch(path, init);
      if (!response.ok) {
        toast.error(await readApiError(response));
        return;
      }
      toast.success((await response.text()) || "Hecho");
      onDone?.();
      refresh();
    } catch (error) {
      console.error("Error:", error);
      toast.error("No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  const open = (itemId: number) =>
    send(
      basePath,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // announce: el bot avisa en el chat que ya se puede puntuar
        body: JSON.stringify({ mediaType, itemId, minutes, announce }),
      },
      () => setQuery(""),
    );

  // announce=true: el bot publica en el chat el resumen de la votación
  const close = () => send(`${basePath}?announce=true`, { method: "DELETE" });

  const extend = (extra: number) =>
    send(`${basePath}/extend`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes: extra }),
    });

  const validMinutes =
    Number.isInteger(minutes) && minutes >= MIN_VOTING_MINUTES && minutes <= MAX_VOTING_MINUTES;
  const typedId = /^\d+$/.test(query.trim()) ? Number(query.trim()) : null;
  const remaining = current?.closesAt ? new Date(current.closesAt).getTime() - now : null;
  const labels = MEDIA_LABELS[mediaType];

  return (
    <div className="flex flex-col items-center gap-8 px-4 py-6 w-full max-w-3xl mx-auto">
      <h1 className="text-8xl font-bold font-bebaskai">Votación</h1>

      <section className="w-full flex flex-col gap-4 outline-2 outline-[#00fff9] rounded-xl p-4 bg-[#00fff9]/5">
        <h2 className="text-2xl font-bold text-[#00fff9]">Votación abierta</h2>
        {!current ? (
          <p className="text-gray-400">No hay ninguna votación abierta. Elige qué puntuar abajo.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4">
            <MoviePoster
              posterUrl={current.posterUrl ?? ""}
              title={current.title}
              year={current.releaseYear}
              className="w-24 h-36 shrink-0 rounded"
            />
            <div className="flex flex-col gap-2 flex-1">
              <p className="text-stone-500 text-sm">{MEDIA_LABELS[current.mediaType].singular}</p>
              <p className="text-2xl font-bold text-[#ff2a4b]">
                {current.title} ({current.releaseYear})
              </p>
              <p className="text-gray-300">
                {current.votes} {current.votes === 1 ? "voto" : "votos"}
                {current.categories.length > 0 && (
                  <span className="text-gray-400"> · {current.categories.map((c) => c.label).join(", ")}</span>
                )}
              </p>
              <p className="text-3xl tabular-nums text-[#ffa300]" aria-live="polite">
                {remaining === null ? "Sin límite de tiempo" : `${formatRemaining(remaining)} restantes`}
              </p>
              <div className="flex flex-wrap gap-2">
                {current.closesAt && (
                  <>
                    <button className={secondaryButtonClassName} onClick={() => extend(5)} disabled={busy}>
                      +5 min
                    </button>
                    <button className={secondaryButtonClassName} onClick={() => extend(10)} disabled={busy}>
                      +10 min
                    </button>
                  </>
                )}
                <button className={buttonClassName} onClick={close} disabled={busy}>
                  Cerrar votación
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="w-full flex flex-col gap-4 outline-2 outline-[#cf0060] rounded-xl p-4 bg-[#cf0060]/10">
        <h2 className="text-2xl font-bold text-[#ff2a4b]">Abrir votación</h2>
        {current && (
          <p className="text-sm text-stone-400">Abrir otra votación cierra la actual sin anunciar el resumen.</p>
        )}

        <div className="flex gap-2" role="tablist" aria-label="Tipo de contenido">
          {(["game", "movie"] as MediaType[]).map((type) => (
            <button
              key={type}
              role="tab"
              aria-selected={mediaType === type}
              className={`px-4 py-2 rounded border cursor-pointer transition-colors ${
                mediaType === type
                  ? "border-[#00fff9] bg-[#00fff9]/15 text-[#00fff9] font-bold"
                  : "border-[#cf0060]/60 text-gray-300 hover:border-[#00fff9]"
              }`}
              onClick={() => setMediaType(type)}
            >
              {type === "game" ? "🎮 Juego" : "🎬 Película"}
            </button>
          ))}
        </div>

        <input
          type="search"
          className={inputClassName}
          placeholder={`Busca ${labels.singular === "juego" ? "un juego" : "una película"} por nombre, o escribe su ID de ${mediaType === "game" ? "IGDB" : "TMDB"}`}
          aria-label={`Buscar ${labels.singular}`}
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold">Duración (minutos)</span>
            <input
              type="number"
              className={`${inputClassName} w-28`}
              min={MIN_VOTING_MINUTES}
              max={MAX_VOTING_MINUTES}
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 cursor-pointer">
            <input type="checkbox" checked={announce} onChange={(event) => setAnnounce(event.target.checked)} />
            <span className="text-sm">Avisar en el chat</span>
          </label>
          {!validMinutes && (
            <p className="text-sm text-[#ff2a4b] pb-2">
              Entre {MIN_VOTING_MINUTES} y {MAX_VOTING_MINUTES} minutos.
            </p>
          )}
        </div>

        {typedId !== null && (
          <button className={`${secondaryButtonClassName} self-start`} disabled={busy || !validMinutes} onClick={() => open(typedId)}>
            Usar el ID {typedId}
          </button>
        )}

        <ul className={`flex flex-col gap-2 transition-opacity ${searching ? "opacity-50" : ""}`}>
          {query.trim() !== "" &&
            results.key === searchKey &&
            results.items.map((item) => (
              <li key={item.id}>
                <button
                  className="w-full flex flex-row items-center gap-3 rounded-lg p-2 border border-[#cf0060]/40 hover:border-[#00fff9] hover:bg-[#00fff9]/5 transition-colors text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy || !validMinutes}
                  onClick={() => open(item.id)}
                >
                  <MoviePoster
                    posterUrl={item.posterUrl ?? ""}
                    title={item.title}
                    year={String(item.year ?? "?")}
                    className="w-12 h-18 shrink-0 rounded"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-[#ff2a4b] truncate">
                      {item.title} ({item.year ?? "?"})
                    </span>
                    <span className="block text-sm text-gray-400 truncate">
                      {[item.creator, item.platforms?.slice(0, 4).join(", ")].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-[#00fff9]">Puntuar</span>
                </button>
              </li>
            ))}
          {query.trim() !== "" && results.key === searchKey && results.items.length === 0 && (
            <li className="text-stone-500">Sin resultados.</li>
          )}
        </ul>
      </section>
    </div>
  );
};
