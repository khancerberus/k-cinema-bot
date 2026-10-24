import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { StarService } from './star.service';
import { ChannelService } from '@/channel/channel.service';
import { MOVIE_SORT_KEYS, type MovieListQuery } from './star.dto';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_IDS = 500;

type RawQuery = Record<string, string | undefined>;

const optionalNumber = (
  raw: RawQuery,
  key: string,
  min: number,
  max: number,
) => {
  const value = raw[key]?.trim();
  if (!value) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new BadRequestException(`El parámetro ${key} no es válido.`);
  }
  return number;
};

const optionalDate = (raw: RawQuery, key: string) => {
  const value = raw[key]?.trim();
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(
      `El parámetro ${key} no es una fecha válida.`,
    );
  }
  return date;
};

const parseMovieListQuery = (
  input: Record<string, unknown>,
): MovieListQuery => {
  // Un parámetro repetido (?q=a&q=b) llega como array: se usa el primero
  const raw: RawQuery = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      typeof (Array.isArray(value) ? value[0] : value) === 'string'
        ? String(Array.isArray(value) ? value[0] : value)
        : undefined,
    ]),
  );
  const sort = raw.sort ?? 'lastWatched';
  if (!(MOVIE_SORT_KEYS as readonly string[]).includes(sort)) {
    throw new BadRequestException('El parámetro sort no es válido.');
  }
  const dir = raw.dir ?? 'desc';
  if (dir !== 'asc' && dir !== 'desc') {
    throw new BadRequestException('El parámetro dir no es válido.');
  }

  let ids: number[] | undefined;
  if (raw.ids !== undefined) {
    ids = raw.ids
      .split(',')
      .filter(Boolean)
      .map((id) => Number(id));
    if (
      ids.length > MAX_IDS ||
      ids.some((id) => !Number.isInteger(id) || id <= 0)
    ) {
      throw new BadRequestException('El parámetro ids no es válido.');
    }
  }

  const q = raw.q?.trim().slice(0, 100);

  return {
    q: q || undefined,
    page: Math.trunc(optionalNumber(raw, 'page', 1, 100_000) ?? 1),
    pageSize: Math.trunc(
      optionalNumber(raw, 'pageSize', 1, MAX_PAGE_SIZE) ?? DEFAULT_PAGE_SIZE,
    ),
    sort: sort as MovieListQuery['sort'],
    dir,
    minRating: optionalNumber(raw, 'minRating', 0, 5),
    maxRating: optionalNumber(raw, 'maxRating', 0, 5),
    watchedFrom: optionalDate(raw, 'watchedFrom'),
    watchedTo: optionalDate(raw, 'watchedTo'),
    minYear: optionalNumber(raw, 'minYear', 1800, 3000),
    maxYear: optionalNumber(raw, 'maxYear', 1800, 3000),
    ids,
  };
};

// Ratings públicos de un canal. Las estrellas se envían desde el chat (!star)
@Controller('channels/:channel/movies')
export class StarController {
  constructor(
    private readonly starService: StarService,
    private readonly channelService: ChannelService,
  ) {}

  // Búsqueda, filtros, orden y paginación se resuelven en la base de datos
  @Get()
  async getMovies(
    @Param('channel') channelUsername: string,
    @Query() query: Record<string, unknown>,
  ) {
    const channel = await this.channelService.getByUsername(channelUsername);
    return this.starService.getMovies(
      channel.channelId,
      parseMovieListQuery(query),
    );
  }

  @Get(':tmdbId')
  async getMovieDetails(
    @Param('channel') channelUsername: string,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
  ) {
    const channel = await this.channelService.getByUsername(channelUsername);
    return this.starService.getMovieDetails(channel.channelId, tmdbId);
  }
}
