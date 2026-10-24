import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CurrentMovie } from './current-movie.model';
import { Star } from './star.model';
import { MovieService, releaseYearOf } from '@/movie/movie.service';
import { SetMovieBody } from './current-movie.dto';
import { TwitchChatService } from '@/twitch/twitch-chat.service';
import type { Channel } from '@/channel/channel.model';

export interface MovieActionResult {
  // Texto para la web, o para responder en el chat si no se publicó el aviso
  message: string;
  // true si el aviso ya se publicó en el chat
  announced: boolean;
}

export type ChannelRef = Pick<Channel, 'channelId' | 'channelUsername'>;

@Injectable()
export class CurrentMovieService {
  private readonly logger = new Logger(CurrentMovieService.name);

  constructor(
    @InjectModel(CurrentMovie)
    private currentMovieModel: typeof CurrentMovie,
    @InjectModel(Star)
    private starModel: typeof Star,
    private readonly movieService: MovieService,
    private readonly twitchChat: TwitchChatService,
  ) {}

  async setCurrentMovie(
    channel: ChannelRef,
    body: SetMovieBody,
  ): Promise<MovieActionResult> {
    const { tmdbId, announce } = body;

    const movie = await this.movieService.getCached(tmdbId);

    // Se busca por channelId: no cambia aunque el canal se renombre
    const existing = await this.currentMovieModel.findOne({
      where: { channelId: channel.channelId },
    });
    if (existing) {
      existing.tmdbId = tmdbId;
      existing.mediaType = 'movie';
      await existing.save();
    } else {
      await this.currentMovieModel.create({
        channelUsername: channel.channelUsername,
        channelId: channel.channelId,
        tmdbId,
        mediaType: 'movie',
      });
    }

    if (!movie) {
      return {
        message: `La película con TMDB ID ${tmdbId} no se encontró.`,
        announced: false,
      };
    }

    const status = existing ? 'actualizado' : 'establecido';
    // Queda en el índice de búsqueda aunque todavía no tenga estrellas
    this.movieService.syncMetadataInBackground([tmdbId]);

    const year = String(releaseYearOf(movie) ?? '?');
    const message = `La pelicula se ha ${status} a "${movie.title} (${year})" con TMDB ID ${tmdbId}`;

    if (!announce) {
      return { message, announced: false };
    }

    return this.announce(
      channel.channelUsername,
      this.startAnnouncement(movie.title, year),
      message,
    );
  }

  async getCurrentMovie(channelId: string): Promise<{
    tmdbId: number;
    title: string;
    releaseYear: string;
  }> {
    const currentMovie = await this.currentMovieModel.findOne({
      where: { channelId },
    });

    if (!currentMovie) {
      throw new NotFoundException(
        'No hay ninguna película en puntuación en este momento.',
      );
    }

    const movie = await this.movieService.getCached(currentMovie.tmdbId);

    if (!movie) {
      throw new NotFoundException(
        `La película con TMDB ID ${currentMovie.tmdbId} no se encontró.`,
      );
    }

    return {
      tmdbId: currentMovie.tmdbId,
      title: movie.title,
      releaseYear: String(releaseYearOf(movie) ?? '?'),
    };
  }

  // Cierra la puntuación de la película actual y resume los votos de hoy
  async clearCurrentMovie(
    channel: ChannelRef,
    announce = false,
  ): Promise<MovieActionResult> {
    const currentMovie = await this.currentMovieModel.findOne({
      where: { channelId: channel.channelId },
    });

    if (!currentMovie) {
      return {
        message: 'No hay ninguna película en puntuación en este momento.',
        announced: false,
      };
    }

    const { tmdbId } = currentMovie;
    const movie = await this.movieService.getCached(tmdbId);
    const movieLabel = movie
      ? `"${movie.title} (${releaseYearOf(movie) ?? '?'})"`
      : `TMDB ID ${tmdbId}`;

    // Mismo criterio que submitStar: una valoración por película al día
    const today = new Date();
    const todayStars = await this.starModel.findAll({
      attributes: ['score'],
      where: {
        channelId: channel.channelId,
        tmdbId,
        createdAt: {
          [Op.gte]: new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
          ),
        },
      },
    });

    // Cerrar la puntuación = quitar la película actual del canal (como hasta ahora)
    await currentMovie.destroy();

    const scores = todayStars.map((star) => Number(star.score));
    const votes = scores.length;
    const average = votes
      ? Number((scores.reduce((sum, s) => sum + s, 0) / votes).toFixed(1))
      : 0;
    const votesLabel = `${votes} ${votes === 1 ? 'voto' : 'votos'}`;

    const message = votes
      ? `Puntuación de ${movieLabel} cerrada: ${votesLabel}, promedio ${average}★.`
      : `Puntuación de ${movieLabel} cerrada sin votos.`;

    if (!announce) {
      return { message, announced: false };
    }

    const chatMessage = votes
      ? `🎬 ¡Se cerró la puntuación de ${movieLabel}! ${votesLabel} con un promedio de ${average}★ (nota más alta: ${Math.max(...scores)}★). ¡Gracias por votar! 🍿 Pueden ver el ranking en la web.`
      : `🎬 Se cerró la puntuación de ${movieLabel}, pero nadie votó 😢 ¡A la próxima!`;

    return this.announce(channel.channelUsername, chatMessage, message);
  }

  private startAnnouncement(title: string, year: string) {
    return `🎬 ¡Ya se puede puntuar "${title} (${year})"! Usen !star <0.5 a 5> para darle sus estrellas ⭐`;
  }

  // Si el aviso falla, la acción ya está hecha igualmente
  private async announce(
    channelUsername: string,
    chatMessage: string,
    message: string,
  ): Promise<MovieActionResult> {
    try {
      await this.twitchChat.say(channelUsername, chatMessage);
      return { message, announced: true };
    } catch (error) {
      this.logger.warn(
        `No se pudo avisar en el chat: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        message: `${message} (no se pudo avisar en el chat)`,
        announced: false,
      };
    }
  }
}
