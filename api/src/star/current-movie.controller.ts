import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RatingSessionService } from './rating-session.service';
import type { ExtendBody, SetMovieBody } from './current-movie.dto';
import { ChannelService } from '@/channel/channel.service';
import { ChannelOwnerGuard } from '@/auth/channel-owner.guard';
import { MEDIA_TYPES, type MediaType } from '@/channel/channel.settings';
import { CatalogService } from '@/movie/catalog.service';

const parseMediaType = (value: unknown): MediaType => {
  const mediaType = value ?? 'movie';
  if (!MEDIA_TYPES.includes(mediaType as MediaType)) {
    throw new BadRequestException('El tipo de contenido no es válido.');
  }
  return mediaType as MediaType;
};

// Solo el streamer del canal puede ver y cambiar el contenido en puntuación.
// La ruta conserva su nombre histórico (current-movie) aunque ahora también acepta juegos.
@Controller('channels/:channel/current-movie')
@UseGuards(ChannelOwnerGuard)
export class CurrentMovieController {
  constructor(
    private readonly ratingSessionService: RatingSessionService,
    private readonly channelService: ChannelService,
    private readonly catalog: CatalogService,
  ) {}

  @Get()
  async getCurrentMovie(@Param('channel') channelUsername: string) {
    const channel = await this.channelService.getByUsername(channelUsername);
    return this.ratingSessionService.getCurrent(channel.channelId);
  }

  // Buscador de la web: ?type=movie|game&q=texto
  @Get('search')
  async search(@Query('type') type: string, @Query('q') q: string) {
    const query = String(q ?? '')
      .trim()
      .slice(0, 100);
    if (!query) return [];
    return this.catalog.search(parseMediaType(type), query);
  }

  @Post()
  async setMovie(
    @Param('channel') channelUsername: string,
    @Body() body: SetMovieBody,
  ): Promise<string> {
    const mediaType = parseMediaType(body?.mediaType);
    const itemId = Number(body?.itemId ?? body?.tmdbId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new BadRequestException('itemId is required.');
    }
    const minutes =
      body.minutes === undefined || body.minutes === null
        ? undefined
        : Number(body.minutes);

    const channel = await this.channelService.getByUsername(channelUsername);
    const info = await this.catalog.getInfo(mediaType, itemId);
    if (!info) {
      throw new NotFoundException(
        `No se encontró el contenido con ID ${itemId}.`,
      );
    }
    return (
      await this.ratingSessionService.open(channel, info, {
        minutes,
        announce: body.announce === true,
      })
    ).message;
  }

  @Patch('extend')
  async extend(
    @Param('channel') channelUsername: string,
    @Body() body: ExtendBody,
  ): Promise<string> {
    const minutes = Number(body?.minutes);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      throw new BadRequestException('minutes is required.');
    }
    const channel = await this.channelService.getByUsername(channelUsername);
    return this.ratingSessionService.extend(channel, minutes);
  }

  // ?announce=true publica en el chat el resumen de la votación
  @Delete()
  async clearCurrentMovie(
    @Param('channel') channelUsername: string,
    @Query('announce') announce?: string,
  ): Promise<string> {
    const channel = await this.channelService.getByUsername(channelUsername);
    return (await this.ratingSessionService.close(channel, announce === 'true'))
      .message;
  }
}
