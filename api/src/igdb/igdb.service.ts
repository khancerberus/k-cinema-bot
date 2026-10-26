import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AxiosError } from 'axios';
import Redis from 'ioredis';

// Juego tal como lo devuelve IGDB con los campos de GAME_FIELDS
export interface IgdbGame {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  // Lanzamiento completo (1.0), en segundos (Unix)
  first_release_date?: number;
  // Todos los lanzamientos, incluido el acceso anticipado
  release_dates?: Array<{ date?: number; status?: { name: string } }>;
  cover?: { image_id: string };
  involved_companies?: Array<{ developer: boolean; company: { name: string } }>;
  platforms?: Array<{ abbreviation?: string; name: string }>;
  genres?: Array<{ name: string }>;
}

const API_URL = 'https://api.igdb.com/v4/games';
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TOKEN_CACHE_KEY = 'igdb:app-token';
const GAME_FIELDS =
  'fields name,slug,summary,first_release_date,cover.image_id,involved_companies.developer,involved_companies.company.name,platforms.abbreviation,platforms.name,genres.name,release_dates.date,release_dates.status.name;';
// Juego principal, expansión, expansión independiente, remake, remaster, edición ampliada y port
// (la búsqueda no muestra actualizaciones, mods, packs ni DLC)
const PLAYABLE_GAME_TYPES = '(0,2,4,8,9,10,11)';

// Las comillas y barras romperían la consulta de IGDB (apicalypse)
const sanitize = (text: string) =>
  text
    .replace(/["\\;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// IGDB es la base de datos de juegos de Twitch: usa un token de app (client credentials)
// con las mismas credenciales que el login con Twitch
@Injectable()
export class IgdbService {
  private readonly logger = new Logger(IgdbService.name);

  constructor(
    private readonly httpService: HttpService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async getGame(igdbId: number): Promise<IgdbGame | null> {
    const [game] = await this.query(`${GAME_FIELDS} where id = ${igdbId};`);
    return game ?? null;
  }

  async getGameBySlug(slug: string): Promise<IgdbGame | null> {
    const [game] = await this.query(
      `${GAME_FIELDS} where slug = "${sanitize(slug)}";`,
    );
    return game ?? null;
  }

  // Juegos jugables (sin versiones de plataforma ni contenido menor), por relevancia
  async searchGames(text: string, limit = 8): Promise<IgdbGame[]> {
    const search = sanitize(text);
    if (!search) return [];
    return this.query(
      `search "${search}"; ${GAME_FIELDS} where version_parent = null & game_type = ${PLAYABLE_GAME_TYPES}; limit ${limit};`,
    );
  }

  private async query(body: string, retry = true): Promise<IgdbGame[]> {
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!clientId || !process.env.TWITCH_CLIENT_SECRET) {
      this.logger.error(
        'Faltan TWITCH_CLIENT_ID o TWITCH_CLIENT_SECRET para consultar IGDB',
      );
      return [];
    }

    try {
      const token = await this.appToken();
      const response = await this.httpService.axiosRef.post<IgdbGame[]>(
        API_URL,
        body,
        {
          headers: {
            'Client-ID': clientId,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
        },
      );
      return response.data;
    } catch (error: unknown) {
      // Token revocado o caducado antes de tiempo: se pide otro una vez
      if (
        retry &&
        error instanceof AxiosError &&
        error.response?.status === 401
      ) {
        await this.redis.del(TOKEN_CACHE_KEY);
        return this.query(body, false);
      }
      this.logger.error(
        `Error consultando IGDB: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  private async appToken(): Promise<string> {
    const cached = await this.redis.get(TOKEN_CACHE_KEY);
    if (cached) return cached;

    const response = await this.httpService.axiosRef.post<{
      access_token: string;
      expires_in: number;
    }>(TOKEN_URL, null, {
      params: {
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
      },
    });

    const { access_token, expires_in } = response.data;
    // Se renueva un poco antes de que caduque
    await this.redis.set(
      TOKEN_CACHE_KEY,
      access_token,
      'EX',
      Math.max(60, expires_in - 300),
    );
    return access_token;
  }
}
