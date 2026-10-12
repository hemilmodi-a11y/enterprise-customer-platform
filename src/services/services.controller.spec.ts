import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
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
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { ServiceStatus } from './service-status.enum';

const admin: AuthenticatedUser = {
  userId: 1,
  email: 'admin@example.com',
  roles: ['Admin'],
};

describe('ServicesController authorization metadata', () => {
  it('requires JWT authentication and role checks on all endpoints', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      ServicesController,
    ) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });
});

describe('ServicesController HTTP integration', () => {
  let app: INestApplication;
  const servicesService = {
    create: jest.fn(),
    list: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ServicesController],
      providers: [{ provide: ServicesService, useValue: servicesService }],
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
          req.user = admin;
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/api/v1/services').expect(401);
  });

  it('routes catalog CRUD operations with the expected HTTP statuses', async () => {
    const catalogService = {
      id: 7,
      name: 'Priority Support',
      description: 'Priority incident response',
      category: 'Support',
      status: ServiceStatus.ACTIVE,
      slaMinutes: 120,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    servicesService.create.mockResolvedValue(catalogService);
    servicesService.list.mockResolvedValue({
      items: [catalogService],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    servicesService.findById.mockResolvedValue(catalogService);
    servicesService.update.mockResolvedValue(catalogService);
    servicesService.deactivate.mockResolvedValue({
      ...catalogService,
      status: ServiceStatus.INACTIVE,
    });

    const auth = { Authorization: 'Bearer test-token' };
    await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth)
      .send({
        name: 'Priority Support',
        description: 'Priority incident response',
        category: 'Support',
        slaMinutes: 120,
      })
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/v1/services?page=1&limit=20&category=Support')
      .set(auth)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/services/7')
      .set(auth)
      .expect(200);
    await request(app.getHttpServer())
      .patch('/api/v1/services/7')
      .set(auth)
      .send({ name: 'Updated Support' })
      .expect(200);
    await request(app.getHttpServer())
      .delete('/api/v1/services/7')
      .set(auth)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe(ServiceStatus.INACTIVE);
      });
  });

  it('rejects unexpected fields, invalid query filters, and invalid IDs', async () => {
    const auth = { Authorization: 'Bearer test-token' };
    await request(app.getHttpServer())
      .post('/api/v1/services')
      .set(auth)
      .send({
        name: 'Priority Support',
        description: 'Priority incident response',
        category: 'Support',
        slaMinutes: 120,
        id: 55,
      })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/services?sortBy=passwordHash')
      .set(auth)
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/services/not-an-id')
      .set(auth)
      .expect(400);
  });
});

describe('ServicesController role metadata', () => {
  const controller = ServicesController.prototype;

  it('restricts catalog mutations to Admin and Manager', () => {
    for (const method of ['create', 'update', 'deactivate']) {
      expect(Reflect.getMetadata(ROLES_KEY, controller[method])).toEqual([
        'Admin',
        'Manager',
      ]);
    }
  });

  it('allows authenticated users of any role to read the catalog', () => {
    for (const method of ['list', 'findById']) {
      expect(
        Reflect.getMetadata(ROLES_KEY, controller[method]),
      ).toBeUndefined();
    }
  });
});
