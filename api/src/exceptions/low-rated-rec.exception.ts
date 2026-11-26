import { HttpException, HttpStatus } from '@nestjs/common';

// Recomendación rechazada por tener una aprobación baja en TMDB. El comando de Twitch
// la atrapa para dar timeout a quien recomendó.
export class LowRatedRecommendationException extends HttpException {
  constructor(
    readonly title: string,
    readonly voteAverage: number,
  ) {
    super(
      `${title} tiene ${Math.round(voteAverage * 10)}% de aprobación en TMDB`,
      HttpStatus.BAD_REQUEST,
    );
  }
}
