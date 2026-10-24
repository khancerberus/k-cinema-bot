import { Module, Global } from '@nestjs/common';
import { Redis } from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        // retryStrategy es útil para reconectarse si se pierde la conexión
        const retryStrategy = (times: number) => Math.min(times * 50, 2000);

        // Upstash: "rediss://" activa TLS automáticamente
        if (process.env.REDIS_URL) {
          return new Redis(process.env.REDIS_URL, { retryStrategy });
        }

        return new Redis({
          host: process.env.REDIS_HOST || '192.168.1.7',
          port: 6379,
          retryStrategy,
        });
      },
    },
  ],
  exports: ['REDIS_CLIENT'], // Exportamos el token para inyectarlo en otros servicios
})
export class RedisModule {}
