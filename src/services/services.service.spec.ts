import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CatalogService } from './catalog-service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceStatus } from './service-status.enum';
import { ServicesService } from './services.service';

const admin: AuthenticatedUser = {
  userId: 1,
  email: 'admin@example.com',
  roles: ['Admin'],
};

describe('ServicesService', () => {
  let service: ServicesService;
  let repository: Repository<CatalogService>;

  beforeEach(() => {
    repository = {
      create: jest.fn((entity: Partial<CatalogService>) => entity),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<CatalogService>;
    service = new ServicesService(repository);
  });

  it('creates a service with an active default and SLA in minutes', async () => {
    const now = new Date();
    jest.mocked(repository.save).mockImplementation(
      async (value) =>
        ({
          ...value,
          id: 8,
          createdAt: now,
          updatedAt: now,
        }) as CatalogService,
    );

    const response = await service.create(
      {
        name: 'Priority Support',
        description: 'Priority incident response',
        category: 'Support',
        slaMinutes: 240,
      },
      admin,
    );

    expect(repository.create).toHaveBeenCalledWith({
      name: 'Priority Support',
      description: 'Priority incident response',
      category: 'Support',
      status: ServiceStatus.ACTIVE,
      slaMinutes: 240,
    });
    expect(response).toMatchObject({
      id: 8,
      status: ServiceStatus.ACTIVE,
      slaMinutes: 240,
    });
  });

  it('allows administrators to update service fields and rejects unauthorized updates', async () => {
    const existing = {
      id: 8,
      name: 'Priority Support',
      description: 'Old description',
      category: 'Support',
      status: ServiceStatus.ACTIVE,
      slaMinutes: 240,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CatalogService;
    jest.mocked(repository.findOne).mockResolvedValue(existing);
    jest
      .mocked(repository.save)
      .mockImplementation(async (value) => value as CatalogService);

    const response = await service.update(
      8,
      { name: 'Critical Support', slaMinutes: 60 },
      {
        userId: 2,
        email: 'manager@example.com',
        roles: ['Manager'],
      },
    );

    expect(response).toMatchObject({
      id: 8,
      name: 'Critical Support',
      slaMinutes: 60,
    });
    await expect(
      service.update(
        8,
        { name: 'Unauthorized' },
        {
          userId: 3,
          email: 'customer@example.com',
          roles: ['Customer'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found for unknown service IDs', async () => {
    jest.mocked(repository.findOne).mockResolvedValue(null);
    await expect(service.findById(404)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.update(404, { name: 'Updated' }, admin),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deactivates rather than hard-deleting a service', async () => {
    const existing = {
      id: 8,
      name: 'Priority Support',
      description: 'Priority response',
      category: 'Support',
      status: ServiceStatus.ACTIVE,
      slaMinutes: 240,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CatalogService;
    jest.mocked(repository.findOne).mockResolvedValue(existing);
    jest
      .mocked(repository.save)
      .mockImplementation(async (value) => value as CatalogService);

    const response = await service.deactivate(8, admin);

    expect(response.status).toBe(ServiceStatus.INACTIVE);
    expect(repository.save).toHaveBeenCalled();
  });

  it('filters, searches, allowlist-sorts, and paginates in the database', async () => {
    const queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    jest
      .mocked(repository.createQueryBuilder)
      .mockReturnValue(queryBuilder as never);

    const query = Object.assign(new ListServicesQueryDto(), {
      page: 2,
      limit: 10,
      search: "Support' OR 1=1 --",
      category: 'Support',
      status: ServiceStatus.ACTIVE,
      sortBy: 'slaMinutes',
      sortOrder: 'ASC',
    });
    const response = await service.list(query);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'service.category = :category',
      { category: 'Support' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'service.status = :status',
      { status: ServiceStatus.ACTIVE },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('LIKE :search'),
      { search: "%support' or 1=1 --%" },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'service.slaMinutes',
      'ASC',
    );
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
    expect(response).toMatchObject({
      items: [],
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 0,
    });
  });

  it('rejects protected properties and invalid fields through DTO validation', async () => {
    const createDto = plainToInstance(CreateServiceDto, {
      id: 99,
      name: 'Service',
      description: 'Description',
      category: 'Support',
      slaMinutes: 0,
      createdAt: new Date(),
    });
    const updateDto = plainToInstance(UpdateServiceDto, {
      status: 'deleted',
      updatedAt: new Date(),
      slaMinutes: 10.5,
    });
    const query = plainToInstance(ListServicesQueryDto, {
      limit: '1000',
      sortBy: 'passwordHash',
      status: 'pending',
    });

    const createErrors = await validate(createDto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const updateErrors = await validate(updateDto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const queryErrors = await validate(query);

    expect(createErrors.length).toBeGreaterThan(0);
    expect(updateErrors.length).toBeGreaterThan(0);
    expect(queryErrors.length).toBeGreaterThan(0);
  });

  it('denies create and deactivate to non-administrative roles', async () => {
    const customer: AuthenticatedUser = {
      userId: 5,
      email: 'customer@example.com',
      roles: ['Customer'],
    };

    await expect(
      service.create(
        {
          name: 'Service',
          description: 'Description',
          category: 'Support',
          slaMinutes: 60,
        },
        customer,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deactivate(8, customer)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
