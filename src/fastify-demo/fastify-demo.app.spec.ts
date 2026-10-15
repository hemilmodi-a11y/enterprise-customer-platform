import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { configureFastifyDemoApp } from '../fastify-demo.setup';
import { FastifyDemoModule } from './fastify-demo.module';

describe('NestJS Fastify demonstration API', () => {
  let app: NestFastifyApplication;
  let jwtService: JwtService;
  let originalJwtSecret: string | undefined;
  const logSpy = jest
    .spyOn(Logger.prototype, 'log')
    .mockImplementation(() => {});

  beforeAll(async () => {
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'fastify-demo-test-secret';

    app = await NestFactory.create<NestFastifyApplication>(
      FastifyDemoModule,
      new FastifyAdapter({ logger: false }),
      { logger: false },
    );
    configureFastifyDemoApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
    logSpy.mockRestore();
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('serves health and status through Fastify', async () => {
    const health = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: 'ok' });
    expect(health.headers['x-request-id']).toEqual(expect.any(String));

    const status = await app.inject({
      method: 'GET',
      url: '/api/v1/system/status',
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().status).toBe('ok');
    expect(status.json().uptimeSeconds).toEqual(expect.any(Number));
  });

  it('validates and transforms the echo DTO', async () => {
    const valid = await app.inject({
      method: 'POST',
      url: '/api/v1/demo/echo',
      payload: { message: '  hello  ' },
    });
    expect(valid.statusCode).toBe(200);
    expect(valid.json()).toEqual({ message: 'hello' });

    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/demo/echo',
      payload: { message: 'hello', extra: true },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().statusCode).toBe(400);
  });

  it('applies existing JWT authentication under Fastify', async () => {
    const unauthenticated = await app.inject({
      method: 'GET',
      url: '/api/v1/system/protected',
    });
    expect(unauthenticated.statusCode).toBe(401);

    const token = await jwtService.signAsync({
      sub: 42,
      email: 'manager@example.test',
      roles: ['Manager'],
    });
    const authenticated = await app.inject({
      method: 'GET',
      url: '/api/v1/system/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(authenticated.statusCode).toBe(200);
    expect(authenticated.json()).toEqual({
      message: 'Authenticated access granted',
      userId: 42,
      roles: ['Manager'],
    });

    const customerToken = await jwtService.signAsync({
      sub: 43,
      email: 'customer@example.test',
      roles: ['Customer'],
    });
    const forbidden = await app.inject({
      method: 'GET',
      url: '/api/v1/system/protected',
      headers: { authorization: `Bearer ${customerToken}` },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('returns the Nest not-found response for unknown paths', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/does-not-exist',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().statusCode).toBe(404);
  });

  it('logs request metadata without logging authorization or query values', async () => {
    const token = await jwtService.signAsync({
      sub: 42,
      email: 'manager@example.test',
      roles: ['Manager'],
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/system/protected?private=not-for-logs',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);

    const messages = logSpy.mock.calls.map(([message]) => String(message));
    expect(messages.some((message) => message.includes('GET'))).toBe(true);
    expect(
      messages.some(
        (message) =>
          message.includes(token) || message.includes('not-for-logs'),
      ),
    ).toBe(false);
  });
});
