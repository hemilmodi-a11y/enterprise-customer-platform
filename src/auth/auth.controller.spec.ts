import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
  jest,
} from '@jest/globals';
import request from 'supertest';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

describe('AuthController HTTP statuses', () => {
  let app: INestApplication;
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of Object.values(authService)) {
      method.mockResolvedValue({ message: 'ok' });
    }
  });

  it('returns 201 only for registration and 200 for authentication actions', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'customer@example.test',
        password: 'Password123',
        firstName: 'Taylor',
        lastName: 'Morgan',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'customer@example.test', password: 'Password123' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'refresh-token' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'refresh-token' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'customer@example.test' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'reset-token', newPassword: 'NewPassword123' })
      .expect(200);
  });
});
