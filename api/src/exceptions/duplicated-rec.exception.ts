import { HttpException, HttpStatus } from '@nestjs/common';

export class DuplicatedRecommendationException extends HttpException {
  constructor(username?: string) {
    const normalizedUsername = username?.trim() || 'usuario';
    super(
      `@${normalizedUsername}, disculpa, ya han recomendado esto antes...`,
      HttpStatus.BAD_REQUEST,
    );
  }
}
