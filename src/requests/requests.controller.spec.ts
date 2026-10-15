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
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { ServiceRequestStatus } from './service-request-status.enum';

const customer: AuthenticatedUser = {
  userId: 7,
  email: 'customer@example.com',
  roles: ['Customer'],
};

describe('RequestsController authorization metadata', () => {
  it('requires JWT authentication and role checks on all endpoints', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      RequestsController,
    ) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });
});

describe('RequestsController HTTP integration', () => {
  let app: INestApplication;
  const requestsService = {
    create: jest.fn(),
    list: jest.fn(),
    listMy: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
    assign: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [RequestsController],
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
          req.user = customer;
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
    await request(app.getHttpServer()).get('/api/v1/requests').expect(401);
  });

  it('routes service request operations with expected HTTP statuses', async () => {
    const requestPayload = {
      id: 12,
      customerId: 11,
      serviceId: 5,
      description: 'We need internet restored to the warehouse.',
      status: ServiceRequestStatus.SUBMITTED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    requestsService.create.mockResolvedValue(requestPayload);
    requestsService.list.mockResolvedValue({
      items: [requestPayload],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    requestsService.listMy.mockResolvedValue({
      items: [requestPayload],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    requestsService.findById.mockResolvedValue(requestPayload);
    requestsService.updateStatus.mockResolvedValue({
      ...requestPayload,
      status: ServiceRequestStatus.ASSIGNED,
    });
    requestsService.assign.mockResolvedValue({
      ...requestPayload,
      assignedToUserId: 15,
      assignedAt: new Date().toISOString(),
      status: ServiceRequestStatus.ASSIGNED,
    });

    const auth = { Authorization: 'Bearer test-token' };

    await request(app.getHttpServer())
      .post('/api/v1/requests')
      .set(auth)
      .send({
        serviceId: 5,
        description: 'We need internet restored to the warehouse.',
        priority: 'High',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/requests?page=1&limit=20')
      .set(auth)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/requests/my')
      .set(auth)
      .expect(200);
    expect(requestsService.listMy).toHaveBeenCalledWith(
      customer,
      expect.objectContaining({
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/requests/12')
      .set(auth)
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/v1/requests/12/status')
      .set(auth)
      .send({ status: ServiceRequestStatus.ASSIGNED })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/requests/12/assign')
      .set(auth)
      .send({ agentId: 15 })
      .expect(200);
  });

  it('supports validated filters and pagination on the current customer request list', async () => {
    requestsService.listMy.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      limit: 5,
      totalPages: 0,
    });

    await request(app.getHttpServer())
      .get('/api/v1/requests/my?page=2&limit=5&status=Assigned&sortOrder=asc')
      .set({ Authorization: 'Bearer test-token' })
      .expect(200);

    expect(requestsService.listMy).toHaveBeenCalledWith(
      customer,
      expect.objectContaining({
        page: 2,
        limit: 5,
        status: ServiceRequestStatus.ASSIGNED,
        sortOrder: 'ASC',
      }),
    );
  });

  it('rejects unexpected body properties and invalid request IDs', async () => {
    const auth = { Authorization: 'Bearer test-token' };

    await request(app.getHttpServer())
      .post('/api/v1/requests')
      .set(auth)
      .send({
        serviceId: 5,
        description: 'We need internet restored to the warehouse.',
        status: 'Closed',
      })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/requests/my?page=1000001')
      .set(auth)
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/requests/not-an-id')
      .set(auth)
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/requests')
      .set(auth)
      .send({
        serviceId: 5,
        description: 'We need internet restored to the warehouse.',
        priority: 'Critical',
      })
      .expect(400);
  });
});

describe('RequestsController role metadata', () => {
  const controller = RequestsController.prototype;

  it('restricts status changes to administrative and agent roles', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.updateStatus)).toEqual([
      'Admin',
      'Manager',
      'SupportAgent',
    ]);
  });

  it('allows customers to create and list their own requests', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.create)).toEqual([
      'Customer',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, controller.myRequests)).toEqual([
      'Customer',
    ]);
  });

  it('restricts assignment to managers and administrators', () => {
    expect(Reflect.getMetadata(ROLES_KEY, controller.assign)).toEqual([
      'Admin',
      'Manager',
    ]);
  });
});
