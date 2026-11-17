import { Injectable, type MessageEvent } from '@nestjs/common';
import { filter, interval, map, merge, Observable, Subject } from 'rxjs';
import type { MediaType } from '@/channel/channel.settings';
import type { ScoreCategory } from './star-input';

// Voto emitido con !star, para el widget de OBS
export interface StarEvent {
  kind: 'star';
  channelId: string;
  username: string;
  mediaType: MediaType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  score: number;
  // categoryKey → nota (vacío si se puntúa con una sola nota)
  scores: Record<string, number>;
  categories: ScoreCategory[];
}

// Votación abierta (por comando o desde la web), para el banner del widget
export interface SessionOpenEvent {
  kind: 'session-open';
  channelId: string;
  mediaType: MediaType;
  title: string;
  year: number | null;
  posterUrl: string | null;
  minutes: number;
  categories: ScoreCategory[];
}

export type OverlayEvent = StarEvent | SessionOpenEvent;

// Mantiene viva la conexión SSE detrás de proxies
const PING_MS = 25_000;

// Bus en memoria: basta con una sola instancia de la API.
// Cada evento llega al navegador con su kind como tipo SSE ("star", "session-open")
@Injectable()
export class StarEventsService {
  private readonly events = new Subject<OverlayEvent>();

  emit(event: OverlayEvent) {
    this.events.next(event);
  }

  stream(channelId: string): Observable<MessageEvent> {
    const events = this.events.pipe(
      filter((event) => event.channelId === channelId),
      map((data): MessageEvent => ({ type: data.kind, data })),
    );
    const pings = interval(PING_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: '' })),
    );
    return merge(events, pings);
  }
}
