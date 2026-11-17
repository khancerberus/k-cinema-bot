import { useEffect, useState } from "react";
import { useLoaderData, useSearchParams } from "react-router";
import { API_URL, channelPath } from "../lib/api";
import type { ChannelProfile } from "../types/channel.type";
import { StarAlertCard, type OverlayStar } from "../components/StarAlertCard";

// Página para la fuente de navegador de OBS: /:channel/overlay
// Opcional: ?duration=6 (segundos) y ?position=bottom-left|bottom-right|top-left|top-right
const DEFAULT_DURATION_S = 6;
const EXIT_MS = 500;
// Si llegan muchos votos de golpe, no se acumulan sin fin
const MAX_QUEUE = 20;
const DEFAULT_ACCENT = "#ff2a4b";

const POSITIONS = {
  "bottom-left": "bottom-8 left-8",
  "bottom-right": "bottom-8 right-8",
  "top-left": "top-8 left-8",
  "top-right": "top-8 right-8",
} as const;
type Position = keyof typeof POSITIONS;

let nextId = 0;

export const OverlayPage = () => {
  const channel = useLoaderData() as ChannelProfile;
  const [searchParams] = useSearchParams();

  const durationParam = Number(searchParams.get("duration"));
  const durationMs =
    (Number.isFinite(durationParam) && durationParam >= 2 && durationParam <= 30
      ? durationParam
      : DEFAULT_DURATION_S) * 1000;
  const positionParam = searchParams.get("position") ?? "";
  const position: Position = positionParam in POSITIONS ? (positionParam as Position) : "bottom-left";
  const accent = /^#[0-9a-f]{3,8}$/i.test(channel.accentColor) ? channel.accentColor : DEFAULT_ACCENT;

  const [queue, setQueue] = useState<Array<OverlayStar & { id: number }>>([]);
  const [leavingId, setLeavingId] = useState<number | null>(null);
  const current = queue[0];

  // OBS: fondo transparente en vez del de la web
  useEffect(() => {
    const elements = [document.documentElement, document.body];
    const previous = elements.map((element) => element.style.background);
    elements.forEach((element) => (element.style.background = "transparent"));
    return () => elements.forEach((element, i) => (element.style.background = previous[i]));
  }, []);

  // Votos en tiempo real. EventSource se reconecta solo si se corta
  useEffect(() => {
    const source = new EventSource(`${API_URL}${channelPath(channel.channelUsername)}/overlay/events`);
    const onStar = (event: MessageEvent<string>) => {
      try {
        const star = JSON.parse(event.data) as OverlayStar;
        setQueue((items) => (items.length >= MAX_QUEUE ? items : [...items, { ...star, id: nextId++ }]));
      } catch (error) {
        console.error("Evento no válido:", error);
      }
    };
    source.addEventListener("star", onStar);
    return () => {
      source.removeEventListener("star", onStar);
      source.close();
    };
  }, [channel.channelUsername]);

  // Un voto a la vez: se muestra, sale y deja paso al siguiente
  const currentId = current?.id;
  useEffect(() => {
    if (currentId === undefined) return;
    const leave = setTimeout(() => setLeavingId(currentId), durationMs);
    const next = setTimeout(() => setQueue((items) => items.slice(1)), durationMs + EXIT_MS);
    return () => {
      clearTimeout(leave);
      clearTimeout(next);
    };
  }, [currentId, durationMs]);

  if (!current) return null;

  return (
    <div className={`fixed ${POSITIONS[position]}`}>
      <StarAlertCard
        key={current.id}
        star={current}
        accent={accent}
        direction={position.endsWith("right") ? 1 : -1}
        leaving={leavingId === current.id}
      />
    </div>
  );
};

// Canal inexistente o API caída: un aviso discreto visible en la vista previa de OBS
export const OverlayError = () => (
  <p className="fixed bottom-4 left-4 rounded bg-black/70 px-3 py-2 text-sm text-[#ff2a4b]">
    K-Cinema: no se pudo cargar el canal del widget.
  </p>
);
