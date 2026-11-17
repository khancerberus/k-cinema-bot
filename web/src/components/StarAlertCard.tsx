import type { CSSProperties } from "react";
import type { MediaType } from "../types/channel.type";

// Voto recibido por SSE (GET /channels/:channel/overlay/events)
export interface OverlayStar {
  username: string;
  mediaType: MediaType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  score: number;
  scores: Record<string, number>;
  categories: Array<{ key: string; label: string }>;
}

const MAX_STARS = 5;
const STAR_PATH =
  "M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z";

// Una estrella: vacía de fondo y la parte llena recortada encima (0, 0.5 o 1)
const Star = ({ fill, delay }: { fill: number; delay: number }) => (
  <span className="relative block size-11">
    <svg viewBox="0 0 24 24" className="absolute inset-0 size-full text-white/15">
      <path d={STAR_PATH} fill="currentColor" />
    </svg>
    {fill > 0 && (
      <span
        className="absolute inset-y-0 left-0 overflow-hidden animate-star-pop"
        style={{ width: `${fill * 100}%`, animationDelay: `${delay}ms` }}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-11 text-[#ffd23f] drop-shadow-[0_0_8px_rgba(255,210,63,0.9)]"
        >
          <path d={STAR_PATH} fill="currentColor" />
        </svg>
      </span>
    )}
  </span>
);

interface StarAlertCardProps {
  star: OverlayStar;
  accent: string;
  // -1: entra y sale por la izquierda, 1: por la derecha
  direction: 1 | -1;
  leaving: boolean;
}

export const StarAlertCard = ({ star, accent, direction, leaving }: StarAlertCardProps) => {
  const breakdown = star.categories
    .filter((category) => star.scores[category.key] !== undefined)
    .map((category) => `${category.label} ${star.scores[category.key]}`)
    .join(" · ");

  const style = {
    "--accent": accent,
    "--dir": direction,
    borderColor: accent,
    boxShadow: `0 0 28px ${accent}, inset 0 0 22px ${accent}55`,
  } as CSSProperties;

  return (
    <div
      className={`relative flex w-[600px] overflow-hidden rounded-2xl border-2 bg-[#05061f]/90 ${
        leaving ? "animate-overlay-out" : "animate-overlay-in"
      }`}
      style={style}
    >
      {star.posterUrl ? (
        <img
          src={star.posterUrl}
          alt=""
          className="w-36 h-54 shrink-0 object-cover animate-poster-in"
        />
      ) : (
        <div className="w-36 h-54 shrink-0 flex items-center justify-center text-6xl bg-[var(--accent)]/20 animate-poster-in">
          {star.mediaType === "game" ? "🎮" : "🎬"}
        </div>
      )}

      <div className="flex flex-col justify-center gap-2 min-w-0 flex-1 px-5 py-4 [text-shadow:0_2px_6px_rgba(0,0,0,0.8)]">
        <p className="font-bebaskai text-3xl leading-none tracking-wide text-white truncate">
          <span style={{ color: accent }}>{star.username}</span>{" "}
          <span className="text-gray-300">puntuó {star.mediaType === "game" ? "el juego" : "la película"}</span>
        </p>
        <p className="font-bebaskai text-5xl leading-[0.95] text-white line-clamp-2">
          {star.title}
          {star.year !== null && <span className="text-3xl text-gray-400"> ({star.year})</span>}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5">
            {Array.from({ length: MAX_STARS }, (_, i) => (
              <Star key={i} fill={Math.min(1, Math.max(0, star.score - i))} delay={450 + i * 140} />
            ))}
          </div>
          <span
            className="font-bebaskai text-6xl leading-none text-[#ffd23f] drop-shadow-[0_0_10px_rgba(255,210,63,0.8)] animate-star-pop"
            style={{ animationDelay: `${450 + MAX_STARS * 140}ms` }}
          >
            {star.score}
          </span>
        </div>
        {breakdown && <p className="text-sm font-semibold text-gray-300 truncate">{breakdown}</p>}
      </div>

      {/* Destello que cruza la tarjeta al aparecer */}
      <div className="pointer-events-none absolute inset-0 animate-overlay-shine bg-[linear-gradient(110deg,transparent_35%,rgba(255,255,255,0.35)_50%,transparent_65%)]" />
    </div>
  );
};
