import type { CSSProperties } from "react";
import type { MediaType } from "../types/channel.type";

// Votación abierta recibida por SSE (evento "session-open")
export interface OverlaySessionOpen {
  mediaType: MediaType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  minutes: number;
  categories: Array<{ key: string; label: string }>;
}

interface VotingBannerProps {
  session: OverlaySessionOpen;
  accent: string;
  leaving: boolean;
}

// Banner ancho arriba al centro: avisa que ya se puede puntuar con !star
export const VotingBanner = ({ session, accent, leaving }: VotingBannerProps) => {
  const style = {
    "--accent": accent,
    borderColor: accent,
    boxShadow: `0 0 36px ${accent}, inset 0 0 26px ${accent}55`,
  } as CSSProperties;
  const hasCategories = session.categories.length > 0;

  return (
    <div
      className={`relative flex items-center gap-5 w-[880px] overflow-hidden rounded-2xl border-2 bg-[#05061f]/90 px-5 py-4 ${
        leaving ? "animate-banner-out" : "animate-banner-in"
      }`}
      style={style}
    >
      {session.posterUrl ? (
        <img
          src={session.posterUrl}
          alt=""
          className="w-24 h-36 shrink-0 rounded-lg object-cover animate-poster-in"
        />
      ) : (
        <div className="w-24 h-36 shrink-0 flex items-center justify-center rounded-lg text-5xl bg-[var(--accent)]/20 animate-poster-in">
          {session.mediaType === "game" ? "🎮" : "🎬"}
        </div>
      )}

      <div className="flex flex-col gap-1.5 min-w-0 flex-1 [text-shadow:0_2px_6px_rgba(0,0,0,0.8)]">
        <p
          className="font-bebaskai text-5xl leading-none tracking-wider animate-banner-pulse"
          style={{ color: accent, textShadow: `0 0 18px ${accent}` }}
        >
          ¡Ronda de puntuación abierta!
        </p>
        <p className="font-bebaskai text-4xl leading-[0.95] text-white truncate">
          {session.mediaType === "game" ? "🎮" : "🎬"} {session.title}
          {session.year !== null && <span className="text-2xl text-gray-400"> ({session.year})</span>}
        </p>
        <p className="text-lg font-semibold text-gray-200">
          Puntúa en el chat con{" "}
          <span className="font-bebaskai text-2xl tracking-wide text-[#ffd23f]">!star 4</span>
          {hasCategories ? (
            <>
              {" "}o una nota por categoría:{" "}
              <span className="font-bebaskai text-2xl tracking-wide text-[#ffd23f]">
                !star {session.categories.map(() => "4").join(" ")}
              </span>
            </>
          ) : (
            " (de 0.5 a 5)"
          )}
        </p>
        {hasCategories && (
          <p className="text-sm font-semibold text-gray-400 truncate">
            {session.categories.map((category) => category.label).join(" · ")}
          </p>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-center justify-center rounded-xl border-2 border-[#ffd23f]/70 px-4 py-2 [text-shadow:0_2px_6px_rgba(0,0,0,0.8)]">
        <span className="font-bebaskai text-6xl leading-none text-[#ffd23f]">{session.minutes}</span>
        <span className="font-bebaskai text-xl leading-none text-gray-300">min</span>
      </div>

      {/* Destello que cruza el banner al aparecer */}
      <div className="pointer-events-none absolute inset-0 animate-overlay-shine bg-[linear-gradient(110deg,transparent_35%,rgba(255,255,255,0.35)_50%,transparent_65%)]" />
    </div>
  );
};
