import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import {
  configureSwagger,
  SWAGGER_JSON_PATH,
  SWAGGER_UI_PATH,
} from './swagger.config';

describe('Swagger/OpenAPI configuration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        AuthController,
        UsersController,
        NotificationsController,
        AnalyticsController,
      ],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refresh: jest.fn(),
            logout: jest.fn(),
            forgotPassword: jest.fn(),
            resetPassword: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: { findAll: jest.fn(), findById: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: {
            create: jest.fn(),
            listForUser: jest.fn(),
            markRead: jest.fn(),
          },
        },
        {
          provide: AnalyticsService,
          useValue: { openRequestsByCategory: jest.fn() },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    configureSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves Swagger UI and the OpenAPI JSON at the documented paths', async () => {
    await request(app.getHttpServer())
      .get(`/${SWAGGER_UI_PATH}`)
      .expect(200)
      .expect('Content-Type', /html/);

    await request(app.getHttpServer())
      .get(`/${SWAGGER_JSON_PATH}`)
      .expect(200)
      .expect('Content-Type', /json/);
  });

  it('documents auth DTOs, safe user responses, and protected JWT operations', async () => {
    const response = await request(app.getHttpServer())
      .get(`/${SWAGGER_JSON_PATH}`)
      .expect(200);
    const spec = response.body;

    expect(
      spec.paths['/api/v1/auth/login'].post.requestBody.content[
        'application/json'
      ].schema,
    ).toEqual({ $ref: '#/components/schemas/LoginDto' });
    expect(
      spec.paths['/api/v1/auth/login'].post.responses['200'].content[
        'application/json'
      ].schema,
    ).toEqual({ $ref: '#/components/schemas/AuthTokenResponseDto' });
    expect(spec.components.schemas.LoginDto.required).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
    expect(spec.components.schemas.LoginDto.properties.password).toMatchObject({
      format: 'password',
      minLength: 8,
      maxLength: 100,
    });
    expect(
      spec.components.schemas.AuthTokenResponseDto.properties.refreshToken,
    ).toBeDefined();
    expect(spec.paths['/api/v1/users'].get.security).toEqual([{ bearer: [] }]);
    expect(spec.components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(
      spec.components.schemas.UserResponseDto.properties,
    ).not.toHaveProperty('passwordHash');
    expect(spec.paths['/api/v1/notifications'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'page', in: 'query' }),
        expect.objectContaining({ name: 'limit', in: 'query' }),
        expect.objectContaining({ name: 'unreadOnly', in: 'query' }),
        expect.objectContaining({ name: 'sortOrder', in: 'query' }),
      ]),
    );
    expect(
      spec.paths['/api/v1/analytics/open-requests-by-category'].get.parameters,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'category', in: 'query' }),
      ]),
    );
    expect(
      spec.paths['/api/v1/notifications/unread-count'].get.security,
    ).toEqual([{ bearer: [] }]);
    expect(spec.paths['/api/v1/notifications/read-all'].patch.security).toEqual(
      [{ bearer: [] }],
    );
    expect(JSON.stringify(spec)).not.toContain('eyJ');
  });
});
