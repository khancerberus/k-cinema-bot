import { Injectable, type MessageEvent } from '@nestjs/common';
import { filter, interval, map, merge, Observable, Subject } from 'rxjs';
import type { MediaType } from '@/channel/channel.settings';
import type { ScoreCategory } from './star-input';

// Voto emitido con !star, para el widget de OBS
export interface StarEvent {
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

// Mantiene viva la conexión SSE detrás de proxies
const PING_MS = 25_000;

// Bus en memoria: basta con una sola instancia de la API
@Injectable()
export class StarEventsService {
  private readonly events = new Subject<StarEvent>();

  emit(event: StarEvent) {
    this.events.next(event);
  }

  stream(channelId: string): Observable<MessageEvent> {
    const stars = this.events.pipe(
      filter((event) => event.channelId === channelId),
      map((data): MessageEvent => ({ type: 'star', data })),
    );
    const pings = interval(PING_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: '' })),
    );
    return merge(stars, pings);
  }
}
