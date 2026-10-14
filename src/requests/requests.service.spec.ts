import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Customer } from '../customers/customer.entity';
import { CatalogService } from '../services/catalog-service.entity';
import { ServiceStatus } from '../services/service-status.enum';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { RequestsService } from './requests.service';
import {
  ServiceRequestStatus,
  ServiceRequestStatusPolicy,
} from './service-request-status.enum';
import { ServiceRequest } from './service-request.entity';

const customerActor: AuthenticatedUser = {
  userId: 7,
  email: 'customer@example.com',
  roles: ['Customer'],
};

const adminActor: AuthenticatedUser = {
  userId: 1,
  email: 'admin@example.com',
  roles: ['Admin'],
};

describe('RequestsService', () => {
  let requestsService: RequestsService;
  let repositories: Record<string, any>;
  let syncService: { enqueueRequest: jest.Mock };

  beforeEach(() => {
    const customer = {
      id: 11,
      user: { id: customerActor.userId },
    } as Customer;

    const service = {
      id: 5,
      name: 'Internet Connectivity',
      status: ServiceStatus.ACTIVE,
    } as CatalogService;

    const request = {
      id: 99,
      customerId: customer.id,
      serviceId: service.id,
      description: 'We need internet restored.',
      status: ServiceRequestStatus.SUBMITTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ServiceRequest;

    repositories = {
      Customer: {
        findOne: jest.fn().mockResolvedValue(customer),
      },
      CatalogService: {
        findOne: jest.fn().mockResolvedValue(service),
      },
      ServiceRequest: {
        create: jest.fn((entity) => entity),
        save: jest.fn(async (entity) => ({ ...entity, ...request })),
        findOne: jest.fn().mockResolvedValue(request),
        createQueryBuilder: jest.fn(),
      },
    };

    const dataSource = {
      getRepository: jest.fn((target) => repositories[target.name]),
      transaction: jest.fn(async (callback) =>
        callback({
          getRepository: (target) => repositories[target.name],
        }),
      ),
    };

    syncService = { enqueueRequest: jest.fn() };
    requestsService = new RequestsService(dataSource as any, syncService as any);
  });

  it('creates a request for an authenticated customer when the service is active', async () => {
    const response = await requestsService.create(
      { serviceId: 5, description: 'We need internet restored.' },
      customerActor,
    );

    expect(repositories.Customer.findOne).toHaveBeenCalled();
    expect(repositories.CatalogService.findOne).toHaveBeenCalledWith({
      where: { id: 5, status: ServiceStatus.ACTIVE },
    });
    expect(response).toMatchObject({
      customerId: 11,
      serviceId: 5,
      status: ServiceRequestStatus.SUBMITTED,
    });
    expect(syncService.enqueueRequest).toHaveBeenCalledWith(
      expect.any(Object),
      99,
    );
  });

  it('rejects unauthorized creation and invalid status changes', async () => {
    await expect(
      requestsService.create(
        { serviceId: 5, description: 'We need internet restored.' },
        adminActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const request = {
      id: 99,
      customerId: 11,
      serviceId: 5,
      description: 'Need help',
      status: ServiceRequestStatus.SUBMITTED,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: { user: { id: customerActor.userId } },
    } as ServiceRequest;
    jest.spyOn(requestsService as any, 'getRequestOrThrow').mockResolvedValue(request);

    await expect(
      requestsService.updateStatus(
        99,
        { status: ServiceRequestStatus.IN_PROGRESS },
        adminActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows listing only the current customer’s own request records', async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[{ id: 99 }], 1]),
    };

    repositories.ServiceRequest.createQueryBuilder.mockReturnValue(queryBuilder);
    const response = await requestsService.list(
      Object.assign(new ListRequestsQueryDto(), {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      }),
      customerActor,
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'request.customerId = :customerId',
      { customerId: 11 },
    );
    expect(response.total).toBe(1);
  });

  it('enforces customer-only access and not found handling', async () => {
    const otherCustomer = {
      id: 44,
      user: { id: 999 },
    } as Customer;
    const request = {
      id: 99,
      customerId: 44,
      serviceId: 5,
      description: 'Other user record',
      status: ServiceRequestStatus.SUBMITTED,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: otherCustomer,
    } as ServiceRequest;

    jest
      .spyOn(requestsService as any, 'getRequestOrThrow')
      .mockResolvedValue(request);

    await expect(requestsService.findById(99, customerActor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    jest
      .spyOn(requestsService as any, 'getRequestOrThrow')
      .mockRejectedValue(new NotFoundException('Request not found'));

    await expect(requestsService.findById(404, adminActor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('validates the centralized transition policy', () => {
    expect(() =>
      ServiceRequestStatusPolicy.assertTransition(
        ServiceRequestStatus.SUBMITTED,
        ServiceRequestStatus.IN_PROGRESS,
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      ServiceRequestStatusPolicy.assertTransition(
        ServiceRequestStatus.SUBMITTED,
        ServiceRequestStatus.ASSIGNED,
      ),
    ).not.toThrow();
  });
});
