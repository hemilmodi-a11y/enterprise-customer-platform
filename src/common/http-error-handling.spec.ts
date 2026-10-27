import { BadRequestException, Controller, Get, Logger } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { ApiExceptionFilter } from './filters/api-exception.filter';
import { RequestLoggingMiddleware } from './middleware/request-logging.middleware';

@Controller('probe')
class ProbeController {
  @Get('validation-error')
  validationError(): never {
    throw new BadRequestException(['message must not be empty']);
  }

  @Get('internal-error')
  internalError(): never {
    throw new Error('private database connection detail');
  }

  @Get('ok')
  ok() {
    return { status: 'ok' };
  }
}

describe('HTTP error handling and request logging', () => {
  let app: INestApplication;
  const logSpy = jest
    .spyOn(Logger.prototype, 'log')
    .mockImplementation(() => {});

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();

    app = module.createNestApplication({ logger: false });
    const requestLoggingMiddleware = new RequestLoggingMiddleware();
    app.use(requestLoggingMiddleware.use.bind(requestLoggingMiddleware));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    logSpy.mockRestore();
  });

  it('returns a request-correlated validation error shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/validation-error')
      .expect(400);

    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(response.body).toEqual({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      message: 'message must not be empty',
      details: ['message must not be empty'],
      requestId: response.headers['x-request-id'],
    });
  });

  it('does not expose internal exception messages or stack traces', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/internal-error')
      .expect(500);

    expect(response.body).toMatchObject({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      requestId: response.headers['x-request-id'],
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'private database connection detail',
    );
    expect(JSON.stringify(response.body)).not.toContain('stack');
  });

  it('logs a request ID, user context, route, status, and duration without query data', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/ok?access_token=not-for-logs')
      .expect(200);

    const loggedRequest = logSpy.mock.calls
      .map(([message]) => String(message))
      .map((message) => {
        try {
          return JSON.parse(message) as Record<string, unknown>;
        } catch {
          return undefined;
        }
      })
      .find((entry) => entry?.requestId === response.headers['x-request-id']);

    expect(loggedRequest).toMatchObject({
      event: 'http_request',
      requestId: response.headers['x-request-id'],
      userId: null,
      method: 'GET',
      endpoint: '/probe/ok',
      statusCode: 200,
    });
    expect(loggedRequest?.executionTimeMs).toEqual(expect.any(Number));
    expect(JSON.stringify(loggedRequest)).not.toContain('not-for-logs');
  });
});
