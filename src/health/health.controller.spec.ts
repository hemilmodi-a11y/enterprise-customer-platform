import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, it, jest } from '@jest/globals';
import request from 'supertest';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController HTTP routes', () => {
  let app: INestApplication;
  const healthService = {
    live: jest.fn().mockReturnValue({ status: 'ok' }),
    ready: jest.fn().mockResolvedValue({
      status: 'ok',
      dependencies: { mysql: 'up', mongodb: 'down' },
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves liveness and readiness routes', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200, { status: 'ok' });

    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200, {
        status: 'ok',
        dependencies: { mysql: 'up', mongodb: 'down' },
      });
  });

  it('preserves a dependency unavailable response from readiness', async () => {
    healthService.ready.mockRejectedValue(
      new ServiceUnavailableException({
        status: 'degraded',
        dependencies: { mysql: 'down', mongodb: 'up' },
      }),
    );

    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503)
      .expect({
        status: 'degraded',
        dependencies: { mysql: 'down', mongodb: 'up' },
      });
  });
});
