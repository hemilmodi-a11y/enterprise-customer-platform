import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsController', () => {
  it('requires the existing JWT and RBAC guards with support-role access', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AnalyticsController,
    ) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        AnalyticsController.prototype.openRequestsByCategory,
      ),
    ).toEqual(['Admin', 'Manager', 'SupportAgent']);
  });

  describe('HTTP validation and routing', () => {
    let app: INestApplication;
    const analyticsService = {
      openRequestsByCategory: jest.fn(),
    };

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        controllers: [AnalyticsController],
        providers: [{ provide: AnalyticsService, useValue: analyticsService }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: (context: {
            switchToHttp: () => {
              getRequest: () => { headers: Record<string, string | undefined> };
            };
          }) => {
            if (!context.switchToHttp().getRequest().headers.authorization) {
              throw new UnauthorizedException();
            }
            return true;
          },
        })
        .overrideGuard(RolesGuard)
        .useValue({ canActivate: () => true })
        .compile();

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

    it('routes valid category queries and rejects unknown query parameters', async () => {
      analyticsService.openRequestsByCategory.mockResolvedValue({
        items: [{ category: 'Support', openRequestCount: 1 }],
        totalOpenRequests: 1,
      });

      await request(app.getHttpServer())
        .get('/api/v1/analytics/open-requests-by-category?category=Support')
        .set({ Authorization: 'Bearer fake-test-token' })
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/analytics/open-requests-by-category?status=Closed')
        .set({ Authorization: 'Bearer fake-test-token' })
        .expect(400);
    });
  });
});
