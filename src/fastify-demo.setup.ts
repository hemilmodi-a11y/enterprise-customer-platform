import { ValidationPipe } from '@nestjs/common';
import { NestFastifyApplication } from '@nestjs/platform-fastify';

import { FastifyDemoRequestLoggingInterceptor } from './fastify-demo/fastify-demo-request-logging.interceptor';

export function configureFastifyDemoApp(app: NestFastifyApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(app.get(FastifyDemoRequestLoggingInterceptor));
}
