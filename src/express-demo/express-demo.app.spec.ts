import { describe, expect, it, jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { createExpressDemoApp } from './express-demo.app';

const jwtSecret = 'express-demo-test-secret';
const jwtService = new JwtService({ secret: jwtSecret });
const logger = {
  info: jest.fn<(message: string) => void>(),
  error: jest.fn<(message: string) => void>(),
};
const app = createExpressDemoApp({ jwtSecret, logger });

describe('Express demonstration API', () => {
  beforeEach(() => {
    logger.info.mockClear();
    logger.error.mockClear();
  });

  it('returns health and status responses', async () => {
    await request(app).get('/api/v1/health').expect(200, { status: 'ok' });

    const status = await request(app).get('/api/v1/system/status').expect(200);
    expect(status.body.status).toBe('ok');
    expect(status.body.uptimeSeconds).toEqual(expect.any(Number));
  });

  it('validates and echoes a JSON message', async () => {
    await request(app)
      .post('/api/v1/demo/echo')
      .send({ message: 'hello' })
      .expect(200, { message: 'hello' });
  });

  it.each([
    [{ message: ' ' }],
    [{ message: 4 }],
    [{ message: 'valid', unexpected: true }],
    [[]],
  ])('rejects invalid echo payloads', async (body) => {
    await request(app).post('/api/v1/demo/echo').send(body).expect(400);
  });

  it('returns a safe error for malformed JSON', async () => {
    await request(app)
      .post('/api/v1/demo/echo')
      .set('Content-Type', 'application/json')
      .send('{"message":')
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Malformed JSON request body',
      });
  });

  it('requires a valid JWT and an authorized role for the protected route', async () => {
    await request(app).get('/api/v1/system/protected').expect(401);
    await request(app)
      .get('/api/v1/system/protected')
      .set('Authorization', 'Bearer invalid')
      .expect(401);

    const customerToken = jwtService.sign({
      sub: 23,
      email: 'customer@example.test',
      roles: ['Customer'],
    });
    await request(app)
      .get('/api/v1/system/protected')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    const managerToken = jwtService.sign({
      sub: 7,
      email: 'manager@example.test',
      roles: ['Manager'],
    });
    await request(app)
      .get('/api/v1/system/protected')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200, {
        message: 'Authenticated access granted',
        userId: 7,
      });
  });

  it('returns a not-found response for unknown routes', async () => {
    await request(app).get('/not-a-route').expect(404, {
      statusCode: 404,
      error: 'Not Found',
      message: 'Route not found',
    });
  });

  it('logs request metadata without sensitive headers or query strings', async () => {
    await request(app)
      .get('/api/v1/health?token=must-not-be-logged')
      .set('Authorization', 'Bearer must-not-be-logged')
      .expect(200);

    expect(logger.info).toHaveBeenCalledTimes(1);
    const logRecord = String(logger.info.mock.calls[0][0]);
    expect(logRecord).toContain('"method":"GET"');
    expect(logRecord).toContain('"path":"/api/v1/health"');
    expect(logRecord).toContain('"statusCode":200');
    expect(logRecord).not.toContain('must-not-be-logged');
  });

  it('requires an explicit JWT secret', () => {
    expect(() => createExpressDemoApp({ jwtSecret: '' })).toThrow(
      'JWT_SECRET must be configured',
    );
  });
});
