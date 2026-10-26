// Lectura de los argumentos del chat. Funciones puras (sin base de datos) para poder probarlas.
import type { MediaType } from '../channel/channel.settings';

export const MIN_STARS = 0.5;
export const MAX_STARS = 5;

export interface ScoreCategory {
  key: string;
  label: string;
}

export interface ParsedScores {
  // Nota global: el promedio de las categorías, redondeado a un decimal
  score: number;
  // categoryKey → nota. Vacío si se vota sin categorías
  scores: Record<string, number>;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const isNumberToken = (token: string) => /^\d+(?:[.,]\d+)?$/.test(token);

// Acepta coma decimal: 3,5 = 3.5
const toNumber = (token: string) => Number(token.replace(',', '.'));

const isValidStar = (value: number) =>
  Number.isFinite(value) &&
  value >= MIN_STARS &&
  value <= MAX_STARS &&
  value % 0.5 === 0;

export const roundScore = (value: number) => Math.round(value * 10) / 10;

export const scoreFormatHint = (categories: ScoreCategory[]) =>
  categories.length
    ? `una nota para todo (!star 4) o una por categoría en orden: ${categories.map((c) => c.label).join(', ')} (!star ${categories.map(() => '4').join(' ')})`
    : 'un número del 0.5 al 5 y sus intermedios';

// "!star 4" reparte la nota a todas las categorías; "!star 4 3.5 5 4" da una por categoría
export const parseScores = (
  tokens: string[],
  categories: ScoreCategory[],
): ParseResult<ParsedScores> => {
  const expected = categories.length;
  const invalid = (): ParseResult<ParsedScores> => ({
    ok: false,
    error: `usa ${scoreFormatHint(categories)}. Las notas van del 0.5 al 5 en pasos de 0.5.`,
  });

  if (!tokens.length || tokens.some((token) => !isNumberToken(token))) {
    return invalid();
  }
  const values = tokens.map(toNumber);
  if (values.some((value) => !isValidStar(value))) return invalid();

  if (expected === 0) {
    return values.length === 1
      ? { ok: true, value: { score: values[0], scores: {} } }
      : invalid();
  }
  if (values.length !== 1 && values.length !== expected) return invalid();

  const perCategory =
    values.length === 1 ? categories.map(() => values[0]) : values;
  const scores = Object.fromEntries(
    categories.map((category, index) => [category.key, perCategory[index]]),
  );
  const average =
    perCategory.reduce((sum, value) => sum + value, 0) / perCategory.length;

  return { ok: true, value: { score: roundScore(average), scores } };
};

// "!apelar 3 3 4 3 me equivoqué": las notas al principio y el motivo después
export const splitAppealArgs = (tokens: string[]) => {
  const firstText = tokens.findIndex((token) => !isNumberToken(token));
  const end = firstText === -1 ? tokens.length : firstText;
  return {
    scoreTokens: tokens.slice(0, end),
    reason: tokens.slice(end).join(' ').trim(),
  };
};

// "Gráficos 4 · Sonido 3.5 · ..." en el orden de las categorías
export const formatScores = (
  scores: Record<string, number>,
  categories: ScoreCategory[],
) =>
  categories
    .filter((category) => scores[category.key] !== undefined)
    .map((category) => `${category.label} ${scores[category.key]}`)
    .join(' · ');

// Qué contenido activar: un ID, una URL de TMDB / IGDB o un texto a buscar
export type ItemReference =
  | { kind: 'id'; id: number }
  | { kind: 'slug'; slug: string }
  | { kind: 'search'; query: string; year?: number };

export const parseItemReference = (
  mediaType: MediaType,
  text: string,
): ItemReference | null => {
  const input = text.trim();
  if (!input) return null;
  if (/^\d+$/.test(input)) return { kind: 'id', id: Number(input) };

  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      if (mediaType === 'movie' && url.hostname.endsWith('themoviedb.org')) {
        const match = url.pathname.match(/\/movie\/(\d+)/);
        return match ? { kind: 'id', id: Number(match[1]) } : null;
      }
      if (mediaType === 'game' && url.hostname.endsWith('igdb.com')) {
        const match = url.pathname.match(/\/games\/([a-z0-9-]+)/i);
        return match ? { kind: 'slug', slug: match[1].toLowerCase() } : null;
      }
    } catch {
      // No es una URL válida
    }
    return null;
  }

  // Películas: un año al final afina la búsqueda ("Matrix 1999")
  const yearMatch = input.match(/^(.+?)\s+((?:18|19|20)\d{2})$/);
  if (mediaType === 'movie' && yearMatch) {
    return { kind: 'search', query: yearMatch[1], year: Number(yearMatch[2]) };
  }
  return { kind: 'search', query: input };
};

// Duración de la ventana: "15m" o "15min" (con sufijo, para no confundirse con un año)
const DURATION_PATTERN = /^(\d{1,3})m(?:in)?$/i;

export const parseDuration = (token: string | undefined) => {
  const match = token?.match(DURATION_PATTERN);
  return match ? Number(match[1]) : null;
};

export type KCommand =
  | { action: 'open'; mediaType: MediaType; query: string; minutes?: number }
  | { action: 'close' }
  | { action: 'extend'; minutes: number }
  | { action: 'approve' | 'reject'; username: string }
  | { action: 'help' };

const MEDIA_ALIASES: Record<string, MediaType> = {
  movie: 'movie',
  peli: 'movie',
  pelicula: 'movie',
  película: 'movie',
  game: 'game',
  juego: 'game',
};

// !k movie|game <id|url|texto> [15m] · !k close · !k extend 5m · !k aprobar|rechazar @usuario
export const parseKCommand = (args: string[]): KCommand => {
  const [first, ...rest] = args;
  const action = first?.toLowerCase();

  if (!action) return { action: 'help' };

  if (['close', 'cerrar', 'clear'].includes(action)) return { action: 'close' };

  if (['extend', 'extender', 'alargar'].includes(action)) {
    const minutes = parseDuration(rest[0]) ?? Number(rest[0]);
    return Number.isInteger(minutes) && minutes > 0
      ? { action: 'extend', minutes }
      : { action: 'help' };
  }

  if (['aprobar', 'approve', 'rechazar', 'reject'].includes(action)) {
    const username = rest[0]?.replace(/^@/, '').toLowerCase();
    if (!username) return { action: 'help' };
    return {
      action: ['aprobar', 'approve'].includes(action) ? 'approve' : 'reject',
      username,
    };
  }

  const mediaType = MEDIA_ALIASES[action];
  if (!mediaType) return { action: 'help' };

  const minutes = parseDuration(rest[rest.length - 1]);
  const queryTokens = minutes === null ? rest : rest.slice(0, -1);
  const query = queryTokens.join(' ').trim();
  if (!query) return { action: 'help' };

  return minutes === null
    ? { action: 'open', mediaType, query }
    : { action: 'open', mediaType, query, minutes };
};
