import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Detrás de un proxy HTTPS (Render, Railway, nginx...) para que req.secure sea correcto
  app.set('trust proxy', 1);
  // Cookie de "state" del OAuth de Twitch
  app.use(cookieParser());
  // CORS_ORIGIN admite varios orígenes separados por coma (p. ej. Vercel y localhost)
  app.enableCors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
