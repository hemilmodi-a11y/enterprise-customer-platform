import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { configureFastifyDemoApp } from './fastify-demo.setup';
import { FastifyDemoModule } from './fastify-demo/fastify-demo.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    FastifyDemoModule,
    new FastifyAdapter({ logger: false }),
  );
  configureFastifyDemoApp(app);

  const port = app.get(ConfigService).getOrThrow<number>('FASTIFY_PORT');
  await app.listen(port, '0.0.0.0');
  Logger.log(`NestJS Fastify demo listening on port ${port}.`, 'FastifyDemo');
}

void bootstrap().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  Logger.error(
    `NestJS Fastify demo failed to start (${errorName}).`,
    'FastifyDemo',
  );
  process.exitCode = 1;
});
