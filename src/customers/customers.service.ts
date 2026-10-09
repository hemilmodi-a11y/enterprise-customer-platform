import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, SelectQueryBuilder } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';
import { User } from '../users/user.entity';
import { Customer } from './customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerResponseDto } from './dto/customer-response.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const SORT_COLUMNS = {
  createdAt: 'customer.createdAt',
  updatedAt: 'customer.updatedAt',
  email: 'user.email',
  firstName: 'user.firstName',
  lastName: 'user.lastName',
  companyName: 'customer.companyName',
} as const;

@Injectable()
export class CustomersService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateCustomerDto,
    actor: AuthenticatedUser,
  ): Promise<CustomerResponseDto> {
    this.assertAdministrator(actor);

    const email = this.normalizeEmail(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const customer = await this.dataSource.transaction(async (manager) => {
        const users = manager.getRepository(User);
        const roles = manager.getRepository(Role);
        const userRoles = manager.getRepository(UserRole);
        const customers = manager.getRepository(Customer);

        if (await users.findOne({ where: { email } })) {
          throw new ConflictException('Email is already registered');
        }

        const customerRole = await roles.findOne({
          where: { name: 'Customer' },
        });

        if (!customerRole) {
          throw new InternalServerErrorException(
            'Customer role is not configured',
          );
        }

        const user = await users.save(
          users.create({
            email,
            passwordHash,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            isActive: true,
          }),
        );

        await userRoles.save(
          userRoles.create({
            user,
            role: customerRole,
          }),
        );

        return customers.save(
          customers.create({
            user,
            phone: dto.phone ?? null,
            companyName: dto.companyName ?? null,
            address: dto.address ?? null,
          }),
        );
      });

      return this.toResponse(customer);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Email or customer profile already exists');
      }
      throw error;
    }
  }

  async list(query: ListCustomersQueryDto, actor: AuthenticatedUser) {
    this.assertAdministrator(actor);

    const customers = this.dataSource
      .getRepository(Customer)
      .createQueryBuilder('customer')
      .innerJoinAndSelect('customer.user', 'user');

    this.applyFilters(customers, query);

    const sortColumn = Object.hasOwn(SORT_COLUMNS, query.sortBy)
      ? SORT_COLUMNS[query.sortBy]
      : undefined;
    if (!sortColumn) {
      throw new BadRequestException('Unsupported customer sort field');
    }
    customers
      .orderBy(sortColumn, query.sortOrder)
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [entities, total] = await customers.getManyAndCount();

    return {
      items: entities.map((customer) => this.toResponse(customer)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findById(
    id: number,
    actor: AuthenticatedUser,
  ): Promise<CustomerResponseDto> {
    this.assertValidId(id);
    const customer = await this.getCustomerOrThrow(id);
    this.assertCanManageCustomer(actor, customer);
    return this.toResponse(customer);
  }

  async update(
    id: number,
    dto: UpdateCustomerDto,
    actor: AuthenticatedUser,
  ): Promise<CustomerResponseDto> {
    this.assertValidId(id);
    return this.dataSource.transaction(async (manager) => {
      const customers = manager.getRepository(Customer);
      const customer = await customers.findOne({
        where: { id },
        relations: { user: true },
      });

      if (!customer) {
        throw new NotFoundException(`Customer with id ${id} not found`);
      }

      this.assertCanManageCustomer(actor, customer);

      if (dto.firstName !== undefined) {
        customer.user.firstName = dto.firstName.trim();
      }
      if (dto.lastName !== undefined) {
        customer.user.lastName = dto.lastName.trim();
      }
      if (dto.phone !== undefined) {
        customer.phone = dto.phone;
      }
      if (dto.companyName !== undefined) {
        customer.companyName = dto.companyName;
      }
      if (dto.address !== undefined) {
        customer.address = dto.address;
      }

      await manager.getRepository(User).save(customer.user);
      const updated = await customers.save(customer);
      return this.toResponse(updated);
    });
  }

  async updateStatus(
    id: number,
    isActive: boolean,
    actor: AuthenticatedUser,
  ): Promise<CustomerResponseDto> {
    this.assertAdministrator(actor);
    this.assertValidId(id);

    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.getRepository(Customer).findOne({
        where: { id },
        relations: { user: true },
      });

      if (!customer) {
        throw new NotFoundException(`Customer with id ${id} not found`);
      }

      customer.user.isActive = isActive;
      await manager.getRepository(User).save(customer.user);
      return this.toResponse(customer);
    });
  }

  private applyFilters(
    customers: SelectQueryBuilder<Customer>,
    query: ListCustomersQueryDto,
  ): void {
    if (query.status) {
      customers.andWhere('user.isActive = :isActive', {
        isActive: query.status === 'active',
      });
    }

    if (query.search) {
      const search = `%${query.search.toLowerCase()}%`;
      customers.andWhere(
        `(
          LOWER(user.email) LIKE :search OR
          LOWER(user.firstName) LIKE :search OR
          LOWER(user.lastName) LIKE :search OR
          LOWER(customer.phone) LIKE :search OR
          LOWER(customer.companyName) LIKE :search
        )`,
        { search },
      );
    }
  }

  private async getCustomerOrThrow(id: number): Promise<Customer> {
    const customer = await this.dataSource.getRepository(Customer).findOne({
      where: { id },
      relations: { user: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }
    return customer;
  }

  private assertCanManageCustomer(
    actor: AuthenticatedUser,
    customer: Customer,
  ): void {
    if (this.hasAdministratorRole(actor)) {
      return;
    }

    if (actor.roles.includes('Customer') && actor.userId === customer.user.id) {
      return;
    }

    throw new ForbiddenException(
      'You do not have permission to access this customer',
    );
  }

  private assertAdministrator(actor: AuthenticatedUser): void {
    if (!this.hasAdministratorRole(actor)) {
      throw new ForbiddenException(
        'You do not have permission to manage customers',
      );
    }
  }

  private hasAdministratorRole(actor: AuthenticatedUser): boolean {
    return actor.roles.includes('Admin') || actor.roles.includes('Manager');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private assertValidId(id: number): void {
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('Customer ID must be a positive integer');
    }
  }

  private toResponse(customer: Customer): CustomerResponseDto {
    return {
      id: customer.id,
      user: {
        id: customer.user.id,
        email: customer.user.email,
        firstName: customer.user.firstName,
        lastName: customer.user.lastName,
        isActive: customer.user.isActive,
      },
      phone: customer.phone ?? null,
      companyName: customer.companyName ?? null,
      address: customer.address ?? null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError;
    return (
      typeof driverError === 'object' &&
      driverError !== null &&
      'code' in driverError &&
      driverError.code === 'ER_DUP_ENTRY'
    );
  }
}
