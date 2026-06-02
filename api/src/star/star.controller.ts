import { Controller } from '@nestjs/common';
import { StarService } from './star.service';

@Controller('star')
export class StarController {
  constructor(private readonly starService: StarService) {}
}
