import { Injectable } from '@nestjs/common';
import type { MediaType } from '@/channel/channel.settings';
import { TmdbService } from '@/tmdb/tmdb.service';
import { IgdbService } from '@/igdb/igdb.service';
import type { ItemReference } from '@/star/star-input';
import {
  MovieService,
  directorsOf,
  releaseYearOf,
  type CachedMovie,
} from './movie.service';
import {
  GameService,
  developersOf,
  earlyAccessYearOf,
  gameCoverUrlOf,
  gameReleaseYearOf,
  type CachedGame,
} from './game.service';

// Datos de una película o un juego con la misma forma, para la puntuación y la web
export interface MediaInfo {
  mediaType: MediaType;
  id: number;
  title: string;
  year: number | null;
  // Directores (películas) o desarrolladoras (juegos), separados por coma
  creator: string;
  synopsis: string;
  posterUrl: string | null;
  // Ficha en TMDB o IGDB
  sourceUrl: string | null;
  // Solo juegos
  platforms?: string[];
  genres?: string[];
  // Año del acceso anticipado si lo hubo antes del 1.0 (year es siempre el 1.0)
  earlyAccessYear?: number | null;
}

const SEARCH_LIMIT = 8;

const tmdbPosterUrl = (path: string | null | undefined) =>
  path ? `https://image.tmdb.org/t/p/w500${path}` : null;

const tmdbUrl = (id: number) => `https://www.themoviedb.org/movie/${id}`;

export const movieInfo = (id: number, movie: CachedMovie): MediaInfo => ({
  mediaType: 'movie',
  id,
  title: movie.title,
  year: releaseYearOf(movie),
  creator: directorsOf(movie).join(', '),
  synopsis: movie.overview,
  posterUrl: tmdbPosterUrl(movie.poster_path),
  sourceUrl: tmdbUrl(id),
});

export const gameInfo = (game: CachedGame): MediaInfo => ({
  mediaType: 'game',
  id: game.id,
  title: game.name,
  year: gameReleaseYearOf(game),
  creator: developersOf(game).join(', '),
  synopsis: game.summary ?? '',
  posterUrl: gameCoverUrlOf(game),
  sourceUrl: game.slug ? `https://www.igdb.com/games/${game.slug}` : null,
  platforms: game.platforms?.map((p) => p.abbreviation || p.name) ?? [],
  genres: game.genres?.map((g) => g.name) ?? [],
  earlyAccessYear: earlyAccessYearOf(game),
});

// "Título (año)" para los mensajes del chat
export const mediaLabel = (info: Pick<MediaInfo, 'title' | 'year'>) =>
  `"${info.title} (${info.year ?? '?'})"`;

@Injectable()
export class CatalogService {
  constructor(
    private readonly movieService: MovieService,
    private readonly gameService: GameService,
    private readonly tmdbService: TmdbService,
    private readonly igdbService: IgdbService,
  ) {}

  async getInfo(mediaType: MediaType, id: number): Promise<MediaInfo | null> {
    if (mediaType === 'game') {
      const game = await this.gameService.getCached(id);
      return game ? gameInfo(game) : null;
    }
    const movie = await this.movieService.getCached(id);
    return movie ? movieInfo(id, movie) : null;
  }

  async getInfoMany(
    mediaType: MediaType,
    ids: number[],
  ): Promise<Map<number, MediaInfo>> {
    const result = new Map<number, MediaInfo>();
    if (mediaType === 'game') {
      for (const [id, game] of await this.gameService.getCachedMany(ids)) {
        result.set(id, gameInfo(game));
      }
    } else {
      for (const [id, movie] of await this.movieService.getCachedMany(ids)) {
        result.set(id, movieInfo(id, movie));
      }
    }
    return result;
  }

  // Resultados para el buscador de la web (sin directores: TMDB no los da en la búsqueda)
  async search(
    mediaType: MediaType,
    query: string,
    year?: number,
  ): Promise<MediaInfo[]> {
    if (mediaType === 'game') {
      const games = await this.igdbService.searchGames(query, SEARCH_LIMIT);
      await this.gameService.cache(games);
      return games.map(gameInfo);
    }
    const movies = await this.tmdbService.searchMovies(query, year);
    return movies.slice(0, SEARCH_LIMIT).map((movie) => ({
      mediaType: 'movie',
      id: movie.id,
      title: movie.title,
      year: Number(movie.release_date?.split('-')[0]) || null,
      creator: '',
      synopsis: movie.overview ?? '',
      posterUrl: tmdbPosterUrl(movie.poster_path),
      sourceUrl: tmdbUrl(movie.id),
    }));
  }

  // Lo que se escribe en !k: un ID, una URL o el primer resultado de buscar el texto
  async resolve(
    mediaType: MediaType,
    reference: ItemReference,
  ): Promise<MediaInfo | null> {
    if (reference.kind === 'id') return this.getInfo(mediaType, reference.id);

    if (reference.kind === 'slug') {
      const game = await this.igdbService.getGameBySlug(reference.slug);
      if (!game) return null;
      await this.gameService.cache([game]);
      return gameInfo(game);
    }

    let [first] = await this.search(mediaType, reference.query, reference.year);
    // "Blade Runner 2049": el número no era el año, se busca el texto completo
    if (!first && reference.year) {
      [first] = await this.search(
        mediaType,
        `${reference.query} ${reference.year}`,
      );
    }
    // Se pide la ficha completa (la búsqueda de TMDB no trae directores)
    return first ? this.getInfo(mediaType, first.id) : null;
  }

  syncMetadataInBackground(mediaType: MediaType, ids: number[]) {
    if (mediaType === 'game') {
      this.gameService.syncMetadataInBackground(ids);
    } else {
      this.movieService.syncMetadataInBackground(ids);
    }
  }

  isStale(updatedAt: Date | null) {
    return this.movieService.isStale(updatedAt);
  }
}
