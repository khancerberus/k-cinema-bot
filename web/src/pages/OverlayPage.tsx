import { useEffect, useState } from "react";
import { useLoaderData, useSearchParams } from "react-router";
import { API_URL, channelPath } from "../lib/api";
import type { ChannelProfile } from "../types/channel.type";
import { StarAlertCard, type OverlayStar } from "../components/StarAlertCard";
import { VotingBanner, type OverlaySessionOpen } from "../components/VotingBanner";

// Página para la fuente de navegador de OBS: /:channel/overlay
// Opcional: ?duration=6 (segundos de cada voto), ?position=bottom-left|bottom-right|top-left|top-right
// y ?banner=10 (segundos del banner de votación abierta, arriba al centro)
const DEFAULT_DURATION_S = 6;
const DEFAULT_BANNER_S = 10;
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

// Segundos de la URL dentro de un rango, o el valor por defecto (en ms)
const secondsParam = (value: string | null, fallback: number) => {
  const seconds = Number(value);
  return (value !== null && Number.isFinite(seconds) && seconds >= 2 && seconds <= 60 ? seconds : fallback) * 1000;
};

export const OverlayPage = () => {
  const channel = useLoaderData() as ChannelProfile;
  const [searchParams] = useSearchParams();

  const durationMs = secondsParam(searchParams.get("duration"), DEFAULT_DURATION_S);
  const bannerMs = secondsParam(searchParams.get("banner"), DEFAULT_BANNER_S);
  const positionParam = searchParams.get("position") ?? "";
  const position: Position = positionParam in POSITIONS ? (positionParam as Position) : "bottom-left";
  const accent = /^#[0-9a-f]{3,8}$/i.test(channel.accentColor) ? channel.accentColor : DEFAULT_ACCENT;

  const [queue, setQueue] = useState<Array<OverlayStar & { id: number }>>([]);
  const [leavingId, setLeavingId] = useState<number | null>(null);
  const current = queue[0];
  // Solo el banner de la última votación abierta
  const [banner, setBanner] = useState<(OverlaySessionOpen & { id: number }) | null>(null);
  const [bannerLeavingId, setBannerLeavingId] = useState<number | null>(null);

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
    const onSessionOpen = (event: MessageEvent<string>) => {
      try {
        const session = JSON.parse(event.data) as OverlaySessionOpen;
        setBanner({ ...session, id: nextId++ });
      } catch (error) {
        console.error("Evento no válido:", error);
      }
    };
    source.addEventListener("star", onStar);
    source.addEventListener("session-open", onSessionOpen);
    return () => {
      source.removeEventListener("star", onStar);
      source.removeEventListener("session-open", onSessionOpen);
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

  // Banner: se muestra y sale; una votación nueva lo reemplaza y reinicia el tiempo
  const bannerId = banner?.id;
  useEffect(() => {
    if (bannerId === undefined) return;
    const leave = setTimeout(() => setBannerLeavingId(bannerId), bannerMs);
    const hide = setTimeout(() => setBanner((item) => (item?.id === bannerId ? null : item)), bannerMs + EXIT_MS);
    return () => {
      clearTimeout(leave);
      clearTimeout(hide);
    };
  }, [bannerId, bannerMs]);

  return (
    <>
      {banner && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2">
          <VotingBanner key={banner.id} session={banner} accent={accent} leaving={bannerLeavingId === banner.id} />
        </div>
      )}
      {current && (
        <div className={`fixed ${POSITIONS[position]}`}>
          <StarAlertCard
            key={current.id}
            star={current}
            accent={accent}
            direction={position.endsWith("right") ? 1 : -1}
            leaving={leavingId === current.id}
          />
        </div>
      )}
    </>
  );
};

// Canal inexistente o API caída: un aviso discreto visible en la vista previa de OBS
export const OverlayError = () => (
  <p className="fixed bottom-4 left-4 rounded bg-black/70 px-3 py-2 text-sm text-[#ff2a4b]">
    K-Cinema: no se pudo cargar el canal del widget.
  </p>
);
