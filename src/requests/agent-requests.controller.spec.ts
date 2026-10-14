import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AgentRequestsController } from './agent-requests.controller';
import { RequestsService } from './requests.service';

const manager: AuthenticatedUser = {
  userId: 1,
  email: 'manager@example.com',
  roles: ['Manager'],
};

describe('AgentRequestsController', () => {
  it('applies JWT authentication and support-role authorization', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AgentRequestsController,
    ) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        AgentRequestsController.prototype.listHighPriorityOpen,
      ),
    ).toEqual(['Admin', 'Manager', 'SupportAgent']);
  });

  describe('HTTP validation and routing', () => {
    let app: INestApplication;
    const requestsService = {
      listHighPriorityOpenByAgent: jest.fn(),
    };

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        controllers: [AgentRequestsController],
        providers: [{ provide: RequestsService, useValue: requestsService }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: (context: {
            switchToHttp: () => {
              getRequest: () => {
                headers: Record<string, string | undefined>;
                user?: AuthenticatedUser;
              };
            };
          }) => {
            const req = context.switchToHttp().getRequest();
            if (!req.headers.authorization) {
              throw new UnauthorizedException();
            }
            req.user = manager;
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

    it('routes valid agent requests with transformed pagination', async () => {
      requestsService.listHighPriorityOpenByAgent.mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0,
      });

      await request(app.getHttpServer())
        .get('/api/v1/agents/15/requests/high-priority-open?page=2&limit=10')
        .set({ Authorization: 'Bearer test-token' })
        .expect(200);

      expect(requestsService.listHighPriorityOpenByAgent).toHaveBeenCalledWith(
        15,
        expect.objectContaining({ page: 2, limit: 10 }),
        manager,
      );
    });

    it('rejects unauthenticated, invalid agent IDs, invalid pagination, and unknown query fields', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/agents/15/requests/high-priority-open')
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/v1/agents/nope/requests/high-priority-open')
        .set({ Authorization: 'Bearer test-token' })
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/v1/agents/15/requests/high-priority-open?page=0')
        .set({ Authorization: 'Bearer test-token' })
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/v1/agents/15/requests/high-priority-open?sortBy=secret')
        .set({ Authorization: 'Bearer test-token' })
        .expect(400);
    });
  });
});
