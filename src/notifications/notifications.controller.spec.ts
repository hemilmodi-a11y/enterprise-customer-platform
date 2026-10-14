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
import { NotificationType } from './notification.schema';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

const user: AuthenticatedUser = {
  userId: 27,
  email: 'user@example.com',
  roles: ['Customer'],
};

describe('NotificationsController', () => {
  it('uses JWT/RBAC and limits notification creation to administrative roles', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, NotificationsController),
    ).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        NotificationsController.prototype.create,
      ),
    ).toEqual(['Admin', 'Manager']);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        NotificationsController.prototype.listMine,
      ),
    ).toBeUndefined();
  });

  describe('HTTP behavior', () => {
    let app: INestApplication;
    const notificationsService = {
      create: jest.fn(),
      listForUser: jest.fn(),
      markRead: jest.fn(),
    };

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        controllers: [NotificationsController],
        providers: [
          { provide: NotificationsService, useValue: notificationsService },
        ],
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
            req.user = user;
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

    it('requires authentication and scopes reads/updates to the JWT user ID', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/notifications/me')
        .expect(401);

      notificationsService.listForUser.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      notificationsService.markRead.mockResolvedValue({ id: 'a'.repeat(24) });

      await request(app.getHttpServer())
        .get('/api/v1/notifications/me?unreadOnly=true')
        .set({ Authorization: 'Bearer fake-test-token' })
        .expect(200);
      expect(notificationsService.listForUser).toHaveBeenCalledWith(
        27,
        expect.objectContaining({ unreadOnly: true }),
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${'a'.repeat(24)}/read`)
        .set({ Authorization: 'Bearer fake-test-token' })
        .expect(200);
      expect(notificationsService.markRead).toHaveBeenCalledWith(
        'a'.repeat(24),
        27,
      );
    });

    it('rejects unexpected fields and invalid notification request values', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set({ Authorization: 'Bearer fake-test-token' })
        .send({
          recipientUserId: 27,
          type: NotificationType.SYSTEM,
          title: 'System update',
          message: 'Scheduled maintenance.',
          accessToken: 'unexpected',
        })
        .expect(400);

      await request(app.getHttpServer())
        .get('/api/v1/notifications/me?limit=1000')
        .set({ Authorization: 'Bearer fake-test-token' })
        .expect(400);
    });
  });
});
