import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Customer } from '../customers/customer.entity';
import { CatalogService } from '../services/catalog-service.entity';
import { ServiceStatus } from '../services/service-status.enum';
import { ListAgentRequestsQueryDto } from './dto/list-agent-requests-query.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { RequestsService } from './requests.service';
import {
  OPEN_SERVICE_REQUEST_STATUSES,
  ServiceRequestStatus,
  ServiceRequestStatusPolicy,
} from './service-request-status.enum';
import {
  HIGH_SERVICE_REQUEST_PRIORITIES,
  ServiceRequestPriority,
} from './service-request-priority.enum';
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
  let notificationOutbox: { enqueue: jest.Mock };

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
      priority: ServiceRequestPriority.NORMAL,
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
      UserRole: {
        createQueryBuilder: jest.fn(),
        findOne: jest.fn().mockResolvedValue({ id: 1 }),
      },
      User: {
        findOne: jest.fn().mockResolvedValue({
          id: 15,
          isActive: true,
          isAvailable: true,
          supportCategories: 'Support',
        }),
      },
      Role: {
        findOne: jest.fn().mockResolvedValue({ id: 2, name: 'SupportAgent' }),
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
    notificationOutbox = { enqueue: jest.fn() };
    requestsService = new RequestsService(
      dataSource as any,
      syncService as any,
      notificationOutbox as any,
    );
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
      priority: ServiceRequestPriority.NORMAL,
    });
    expect(syncService.enqueueRequest).toHaveBeenCalledWith(
      expect.any(Object),
      99,
    );
    expect(notificationOutbox.enqueue).toHaveBeenCalledWith(
      expect.any(Object),
      'service-request:99:created',
      expect.objectContaining({
        recipientUserId: customerActor.userId,
        relatedServiceRequestId: 99,
      }),
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
    jest
      .spyOn(requestsService as any, 'getRequestOrThrow')
      .mockResolvedValue(request);

    await expect(
      requestsService.updateStatus(
        99,
        { status: ServiceRequestStatus.IN_PROGRESS },
        adminActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('queues a customer notification in the same transaction as a status change', async () => {
    const timestamp = new Date('2026-10-15T10:00:00Z');
    repositories.ServiceRequest.findOne.mockResolvedValueOnce({
      id: 99,
      customerId: 11,
      serviceId: 5,
      status: ServiceRequestStatus.ASSIGNED,
      priority: ServiceRequestPriority.NORMAL,
    });
    const saved = {
      id: 99,
      customerId: 11,
      serviceId: 5,
      description: 'Need help',
      status: ServiceRequestStatus.IN_PROGRESS,
      priority: ServiceRequestPriority.NORMAL,
      updatedAt: timestamp,
    };
    repositories.ServiceRequest.save.mockResolvedValueOnce(saved);

    await requestsService.updateStatus(
      99,
      { status: ServiceRequestStatus.IN_PROGRESS },
      adminActor,
    );

    expect(notificationOutbox.enqueue).toHaveBeenCalledWith(
      expect.any(Object),
      `service-request:99:status:Assigned:In Progress:${timestamp.getTime()}`,
      expect.objectContaining({
        recipientUserId: customerActor.userId,
        relatedServiceRequestId: 99,
        message: 'Your service request #99 is now In Progress.',
      }),
    );
  });

  it('queues customer and assignee notifications for a new assignment', async () => {
    repositories.ServiceRequest.findOne.mockResolvedValueOnce({
      id: 99,
      customerId: 11,
      serviceId: 5,
      status: ServiceRequestStatus.SUBMITTED,
      assignedToUserId: null,
      service: { category: 'Support' },
    });
    repositories.ServiceRequest.save.mockResolvedValueOnce({
      id: 99,
      customerId: 11,
      serviceId: 5,
      status: ServiceRequestStatus.ASSIGNED,
      assignedToUserId: 15,
      assignedAt: new Date('2026-10-15T10:00:00Z'),
      updatedAt: new Date('2026-10-15T10:00:00Z'),
    });

    await requestsService.assign(99, { agentId: 15 }, adminActor);

    expect(notificationOutbox.enqueue).toHaveBeenCalledTimes(2);
    expect(notificationOutbox.enqueue).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringMatching(/^service-request:99:assignment:15:\d+:agent$/),
      expect.objectContaining({
        recipientUserId: 15,
        message: 'Service request #99 has been assigned to you.',
      }),
    );
    expect(notificationOutbox.enqueue).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringMatching(/^service-request:99:assignment:15:\d+:customer$/),
      expect.objectContaining({
        recipientUserId: customerActor.userId,
        message:
          'Your service request #99 has been assigned to a support agent.',
      }),
    );
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

    repositories.ServiceRequest.createQueryBuilder.mockReturnValue(
      queryBuilder,
    );
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

    await expect(
      requestsService.findById(99, customerActor),
    ).rejects.toBeInstanceOf(ForbiddenException);

    jest
      .spyOn(requestsService as any, 'getRequestOrThrow')
      .mockRejectedValue(new NotFoundException('Request not found'));

    await expect(
      requestsService.findById(404, adminActor),
    ).rejects.toBeInstanceOf(NotFoundException);
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

  it('uses parameterized agent, priority, and open-status filters with database pagination', async () => {
    const agentQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ id: 15 }),
    };
    repositories.UserRole.createQueryBuilder.mockReturnValue(agentQueryBuilder);

    const requestQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 81,
            serviceId: 5,
            status: ServiceRequestStatus.IN_PROGRESS,
            priority: ServiceRequestPriority.URGENT,
            assignedToUserId: 15,
            assignedAt: new Date('2026-10-01T00:00:00Z'),
            createdAt: new Date('2026-09-30T00:00:00Z'),
            updatedAt: new Date('2026-10-01T00:00:00Z'),
          },
        ],
        1,
      ]),
    };
    repositories.ServiceRequest.createQueryBuilder.mockReturnValue(
      requestQueryBuilder,
    );

    const response = await requestsService.listHighPriorityOpenByAgent(
      15,
      Object.assign(new ListAgentRequestsQueryDto(), { page: 2, limit: 5 }),
      {
        userId: 1,
        email: 'manager@example.com',
        roles: ['Manager'],
      },
    );

    expect(agentQueryBuilder.andWhere).toHaveBeenCalledWith(
      'role.name = :roleName',
      { roleName: 'SupportAgent' },
    );
    expect(requestQueryBuilder.where).toHaveBeenCalledWith(
      'request.assignedToUserId = :agentId',
      { agentId: 15 },
    );
    expect(requestQueryBuilder.andWhere).toHaveBeenCalledWith(
      'request.priority IN (:...priorities)',
      { priorities: HIGH_SERVICE_REQUEST_PRIORITIES },
    );
    expect(requestQueryBuilder.andWhere).toHaveBeenCalledWith(
      'request.status IN (:...openStatuses)',
      { openStatuses: OPEN_SERVICE_REQUEST_STATUSES },
    );
    expect(OPEN_SERVICE_REQUEST_STATUSES).not.toContain(
      ServiceRequestStatus.RESOLVED,
    );
    expect(OPEN_SERVICE_REQUEST_STATUSES).not.toContain(
      ServiceRequestStatus.CLOSED,
    );
    expect(requestQueryBuilder.skip).toHaveBeenCalledWith(5);
    expect(requestQueryBuilder.take).toHaveBeenCalledWith(5);
    expect(response).toMatchObject({
      items: [
        {
          id: 81,
          priority: ServiceRequestPriority.URGENT,
          status: ServiceRequestStatus.IN_PROGRESS,
        },
      ],
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    });
  });

  it('denies customers and cross-agent support-agent queries and handles invalid or unknown agents', async () => {
    const agentQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ id: 15 }),
    };
    repositories.UserRole.createQueryBuilder.mockReturnValue(agentQueryBuilder);

    await expect(
      requestsService.listHighPriorityOpenByAgent(
        15,
        new ListAgentRequestsQueryDto(),
        customerActor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      requestsService.listHighPriorityOpenByAgent(
        16,
        new ListAgentRequestsQueryDto(),
        {
          userId: 15,
          email: 'agent@example.com',
          roles: ['SupportAgent'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      requestsService.listHighPriorityOpenByAgent(
        0,
        new ListAgentRequestsQueryDto(),
        adminActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    agentQueryBuilder.getRawOne.mockResolvedValue(null);
    await expect(
      requestsService.listHighPriorityOpenByAgent(
        404,
        new ListAgentRequestsQueryDto(),
        adminActor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns an empty page when the agent has no matching high-priority open requests', async () => {
    repositories.UserRole.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ id: 15 }),
    });
    repositories.ServiceRequest.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    });

    await expect(
      requestsService.listHighPriorityOpenByAgent(
        15,
        new ListAgentRequestsQueryDto(),
        adminActor,
      ),
    ).resolves.toMatchObject({ items: [], total: 0, totalPages: 0 });
  });

  it('propagates an outbox failure so the enclosing request transaction can roll back', async () => {
    syncService.enqueueRequest.mockRejectedValue(
      new Error('outbox insert failed'),
    );

    await expect(
      requestsService.create(
        { serviceId: 5, description: 'We need internet restored.' },
        customerActor,
      ),
    ).rejects.toThrow('outbox insert failed');
  });

  it('rolls back a request transaction when its notification event cannot be queued', async () => {
    notificationOutbox.enqueue.mockRejectedValue(
      new Error('notification outbox insert failed'),
    );

    await expect(
      requestsService.create(
        { serviceId: 5, description: 'We need internet restored.' },
        customerActor,
      ),
    ).rejects.toThrow('notification outbox insert failed');
  });
});
