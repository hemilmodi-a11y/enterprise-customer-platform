import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { User } from '../users/user.entity';
import { Customer } from './customer.entity';
import { CustomersService } from './customers.service';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const admin: AuthenticatedUser = {
  userId: 1,
  email: 'admin@example.com',
  roles: ['Admin'],
};

describe('CustomersService', () => {
  let service: CustomersService;
  let dataSource: DataSource;

  beforeEach(() => {
    dataSource = {
      transaction: jest.fn(),
      getRepository: jest.fn(),
    } as unknown as DataSource;
    service = new CustomersService(dataSource);
  });

  it('creates an account and profile atomically and returns no sensitive fields', async () => {
    const user = {
      id: 11,
      email: 'jane@example.com',
      passwordHash: 'never-return-this-hash',
      firstName: 'Jane',
      lastName: 'Doe',
      isActive: true,
    } as User;
    const savedCustomer = {
      id: 21,
      user,
      phone: '555-1234',
      companyName: null,
      address: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    } as Customer;

    const userRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue(user),
    };
    const roleRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 3, name: 'Customer' }),
    };
    const userRoleRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(),
    };
    const customerRepository = {
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue(savedCustomer),
    };
    const manager = {
      getRepository: jest.fn(
        (entity: typeof User | typeof Customer | object) => {
          if (entity === User) return userRepository;
          if (entity === Customer) return customerRepository;
          if ((entity as { name?: string }).name === 'Role') {
            return roleRepository;
          }
          return userRoleRepository;
        },
      ),
    };
    jest
      .mocked(dataSource.transaction)
      .mockImplementation(async (operation: never) =>
        (operation as (value: typeof manager) => Promise<unknown>)(manager),
      );

    const response = await service.create(
      {
        email: '  Jane@Example.com ',
        password: 'correct-horse-battery',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '555-1234',
      },
      admin,
    );

    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      }),
    );
    expect(userRoleRepository.save).toHaveBeenCalled();
    expect(response.user.email).toBe('jane@example.com');
    expect(JSON.stringify(response)).not.toContain('never-return-this-hash');
  });

  it('allows customers to retrieve only their own profile', async () => {
    const customer = {
      id: 21,
      user: {
        id: 11,
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        isActive: true,
        passwordHash: 'not-in-response',
      },
      phone: null,
      companyName: null,
      address: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Customer;
    jest.mocked(dataSource.getRepository).mockReturnValue({
      findOne: jest.fn().mockResolvedValue(customer),
    } as never);

    const ownUser: AuthenticatedUser = {
      userId: 11,
      email: 'jane@example.com',
      roles: ['Customer'],
    };

    await expect(service.findById(21, ownUser)).resolves.toMatchObject({
      id: 21,
      user: { id: 11 },
    });
    await expect(
      service.findById(21, { ...ownUser, userId: 12 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.findById(21, {
        ...ownUser,
        roles: ['SupportAgent'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found for an unknown customer', async () => {
    jest.mocked(dataSource.getRepository).mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
    } as never);

    await expect(service.findById(999, admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects an existing email instead of creating a duplicate account', async () => {
    const userRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 11 }),
    };
    const manager = {
      getRepository: jest.fn(() => userRepository),
    };
    jest
      .mocked(dataSource.transaction)
      .mockImplementation(async (operation: never) =>
        (operation as (value: typeof manager) => Promise<unknown>)(manager),
      );

    await expect(
      service.create(
        {
          email: 'jane@example.com',
          password: 'correct-horse-battery',
          firstName: 'Jane',
          lastName: 'Doe',
        },
        admin,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates a permitted profile field without returning sensitive account fields', async () => {
    const customer = {
      id: 21,
      user: {
        id: 11,
        email: 'jane@example.com',
        passwordHash: 'never-return-this-hash',
        firstName: 'Jane',
        lastName: 'Doe',
        isActive: true,
      },
      phone: null,
      companyName: null,
      address: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Customer;
    const customerRepository = {
      findOne: jest.fn().mockResolvedValue(customer),
      save: jest.fn(async (value) => value),
    };
    const userRepository = {
      save: jest.fn(async (value) => value),
    };
    const manager = {
      getRepository: jest.fn((entity: typeof User | typeof Customer) =>
        entity === User ? userRepository : customerRepository,
      ),
    };
    jest
      .mocked(dataSource.transaction)
      .mockImplementation(async (operation: never) =>
        (operation as (value: typeof manager) => Promise<unknown>)(manager),
      );

    const response = await service.update(
      21,
      { phone: '555-9876' },
      { userId: 11, email: 'jane@example.com', roles: ['Customer'] },
    );

    expect(response.phone).toBe('555-9876');
    expect(response.user.firstName).toBe('Jane');
    expect(JSON.stringify(response)).not.toContain('never-return-this-hash');
    await expect(
      service.update(
        21,
        { phone: '555-0000' },
        {
          userId: 12,
          email: 'other@example.com',
          roles: ['Customer'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows administrators to change account status using User.isActive', async () => {
    const customer = {
      id: 21,
      user: {
        id: 11,
        email: 'jane@example.com',
        passwordHash: 'never-return-this-hash',
        firstName: 'Jane',
        lastName: 'Doe',
        isActive: true,
      },
      phone: null,
      companyName: null,
      address: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Customer;
    const customerRepository = {
      findOne: jest.fn().mockResolvedValue(customer),
    };
    const userRepository = {
      save: jest.fn(async (value) => value),
    };
    const manager = {
      getRepository: jest.fn((entity: typeof User | typeof Customer) =>
        entity === User ? userRepository : customerRepository,
      ),
    };
    jest
      .mocked(dataSource.transaction)
      .mockImplementation(async (operation: never) =>
        (operation as (value: typeof manager) => Promise<unknown>)(manager),
      );

    const response = await service.updateStatus(21, false, admin);

    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
    expect(response.user.isActive).toBe(false);
    await expect(
      service.updateStatus(21, true, {
        ...admin,
        roles: ['Customer'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies parameterized search, status filtering, allowlisted sorting, and pagination', async () => {
    const queryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    jest.mocked(dataSource.getRepository).mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as never);

    const query = Object.assign(new ListCustomersQueryDto(), {
      page: 3,
      limit: 10,
      search: "' OR 1=1 --",
      status: 'inactive',
      sortBy: 'companyName',
      sortOrder: 'ASC',
    });
    const response = await service.list(query, admin);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'user.isActive = :isActive',
      { isActive: false },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('LIKE :search'),
      { search: "%' or 1=1 --%" },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      'customer.companyName',
      'ASC',
    );
    expect(queryBuilder.skip).toHaveBeenCalledWith(20);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
    expect(response).toMatchObject({
      items: [],
      total: 0,
      page: 3,
      limit: 10,
      totalPages: 0,
    });

    await expect(
      service.list(query, {
        userId: 2,
        email: 'manager@example.com',
        roles: ['Manager'],
      }),
    ).resolves.toMatchObject({ total: 0 });
  });

  it('denies listing to non-administrative roles', async () => {
    const customer: AuthenticatedUser = {
      userId: 11,
      email: 'jane@example.com',
      roles: ['Customer'],
    };

    await expect(
      service.list(new ListCustomersQueryDto(), customer),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects protected and invalid query properties through DTO validation', async () => {
    const protectedUpdate = plainToInstance(UpdateCustomerDto, {
      email: 'attacker@example.com',
      isActive: true,
    });
    const query = plainToInstance(ListCustomersQueryDto, {
      sortBy: 'user.passwordHash',
      limit: '500',
    });
    const invalidStatus = plainToInstance(UpdateCustomerStatusDto, {
      isActive: 'false',
    });

    const updateErrors = await validate(protectedUpdate, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const queryErrors = await validate(query);
    const statusErrors = await validate(invalidStatus);

    expect(updateErrors.length).toBeGreaterThan(0);
    expect(queryErrors.length).toBeGreaterThan(0);
    expect(statusErrors.length).toBeGreaterThan(0);
  });

  it('rejects non-positive customer identifiers', async () => {
    await expect(service.findById(0, admin)).rejects.toMatchObject({
      status: 400,
    });
  });
});
