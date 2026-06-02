import { HttpException, HttpStatus } from '@nestjs/common';

export class DuplicatedRecommendationException extends HttpException {
  constructor() {
    super('DuplicatedRecommendation', HttpStatus.BAD_REQUEST);
  }
}
