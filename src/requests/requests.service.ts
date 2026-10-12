import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository, SelectQueryBuilder } from 'typeorm';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Customer } from '../customers/customer.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';
import { User } from '../users/user.entity';
import { CatalogService } from '../services/catalog-service.entity';
import { ServiceStatus } from '../services/service-status.enum';
import { AssignRequestDto } from './dto/assign-request.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { ServiceRequestResponseDto } from './dto/request-response.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import {
  ServiceRequestStatus,
  ServiceRequestStatusPolicy,
} from './service-request-status.enum';
import { ServiceRequest } from './service-request.entity';

const SORT_COLUMNS = {
  createdAt: 'request.createdAt',
  updatedAt: 'request.updatedAt',
  status: 'request.status',
  serviceId: 'request.serviceId',
} as const;

@Injectable()
export class RequestsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateRequestDto,
    actor: AuthenticatedUser,
  ): Promise<ServiceRequestResponseDto> {
    this.assertCanCreateRequest(actor);

    const customer = await this.getCustomerProfileForUser(actor.userId);
    const service = await this.getActiveService(dto.serviceId);

    const request = this.dataSource.getRepository(ServiceRequest).create({
      customer,
      customerId: customer.id,
      service,
      serviceId: service.id,
      description: dto.description.trim(),
      status: ServiceRequestStatus.SUBMITTED,
    });

    const saved = await this.dataSource
      .getRepository(ServiceRequest)
      .save(request);
    return this.toResponse(saved);
  }

  async list(query: ListRequestsQueryDto, actor: AuthenticatedUser) {
    const requestRepository = this.dataSource.getRepository(ServiceRequest);
    const queryBuilder = requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.customer', 'customer')
      .leftJoinAndSelect('customer.user', 'user')
      .leftJoinAndSelect('request.service', 'service');

    if (this.isCustomer(actor)) {
      const customer = await this.getCustomerProfileForUser(actor.userId);
      queryBuilder.andWhere('request.customerId = :customerId', {
        customerId: customer.id,
      });
    }

    this.applyFilters(queryBuilder, query);

    const sortColumn = Object.hasOwn(SORT_COLUMNS, query.sortBy)
      ? SORT_COLUMNS[query.sortBy]
      : undefined;
    if (!sortColumn) {
      throw new BadRequestException('Unsupported request sort field');
    }

    queryBuilder
      .orderBy(sortColumn, query.sortOrder)
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items: items.map((request) => this.toResponse(request)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async listMy(actor: AuthenticatedUser) {
    this.assertCustomer(actor);
    const query = Object.assign(new ListRequestsQueryDto(), {
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });
    return this.list(query, actor);
  }

  async findById(
    id: number,
    actor: AuthenticatedUser,
  ): Promise<ServiceRequestResponseDto> {
    this.assertValidId(id);
    const request = await this.getRequestOrThrow(id);
    this.assertCanAccessRequest(actor, request);
    return this.toResponse(request);
  }

  async updateStatus(
    id: number,
    dto: UpdateRequestStatusDto,
    actor: AuthenticatedUser,
  ): Promise<ServiceRequestResponseDto> {
    this.assertCanUpdateStatus(actor);
    this.assertValidId(id);

    const request = await this.getRequestOrThrow(id);
    if (this.isCustomer(actor)) {
      throw new ForbiddenException(
        'Customers are not allowed to update request status',
      );
    }

    ServiceRequestStatusPolicy.assertTransition(request.status, dto.status);

    request.status = dto.status;
    const saved = await this.dataSource.getRepository(ServiceRequest).save(request);
    return this.toResponse(saved);
  }

  async assign(
    id: number,
    dto: AssignRequestDto,
    actor: AuthenticatedUser,
  ): Promise<ServiceRequestResponseDto> {
    this.assertCanAssignRequest(actor);
    this.assertValidId(id);

    if (dto.agentId !== undefined) {
      this.assertValidId(dto.agentId);
    }

    return this.dataSource.transaction(async (manager) => {
      const requestRepository = manager.getRepository(ServiceRequest) as Repository<ServiceRequest>;
      const userRepository = manager.getRepository(User) as Repository<User>;
      const roleRepository = manager.getRepository(Role) as Repository<Role>;
      const userRoleRepository = manager.getRepository(UserRole) as Repository<UserRole>;

      const request = await requestRepository.findOne({
        where: { id },
        relations: { service: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException(`Service request with id ${id} not found`);
      }

      if (
        request.status !== ServiceRequestStatus.SUBMITTED &&
        request.status !== ServiceRequestStatus.ASSIGNED
      ) {
        throw new BadRequestException(
          `Request status ${request.status} cannot be assigned`,
        );
      }

      const targetAgent = dto.agentId
        ? await this.findSpecificEligibleAgent(
            dto.agentId,
            request,
            userRepository,
            roleRepository,
            userRoleRepository,
            requestRepository,
          )
        : await this.findBestEligibleAgent(
            request,
            userRepository,
            roleRepository,
            userRoleRepository,
            requestRepository,
          );

      if (!targetAgent) {
        throw new ConflictException(
          'No eligible support agent is available for this service category at the moment.',
        );
      }

      request.assignedToUserId = targetAgent.id;
      request.assignedAt = new Date();
      request.status = ServiceRequestStatus.ASSIGNED;

      const saved = await requestRepository.save(request);
      return this.toResponse(saved);
    });
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<ServiceRequest>,
    query: ListRequestsQueryDto,
  ): void {
    if (query.status) {
      queryBuilder.andWhere('request.status = :status', {
        status: query.status,
      });
    }

    if (query.serviceId) {
      queryBuilder.andWhere('request.serviceId = :serviceId', {
        serviceId: query.serviceId,
      });
    }

    if (query.search) {
      const search = `%${query.search.toLowerCase()}%`;
      queryBuilder.andWhere(
        `(LOWER(request.description) LIKE :search OR LOWER(service.name) LIKE :search)`,
        { search },
      );
    }
  }

  private async getActiveService(id: number): Promise<CatalogService> {
    const service = await this.dataSource.getRepository(CatalogService).findOne({
      where: { id, status: ServiceStatus.ACTIVE },
    });

    if (!service) {
      throw new NotFoundException(`Active service with id ${id} not found`);
    }

    return service;
  }

  private async getCustomerProfileForUser(userId: number): Promise<Customer> {
    const customer = await this.dataSource.getRepository(Customer).findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer profile not found for authenticated user ${userId}`,
      );
    }

    return customer;
  }

  private async getRequestOrThrow(id: number): Promise<ServiceRequest> {
    const request = await this.dataSource.getRepository(ServiceRequest).findOne({
      where: { id },
      relations: { customer: { user: true }, service: true },
    });

    if (!request) {
      throw new NotFoundException(`Service request with id ${id} not found`);
    }

    return request;
  }

  private assertCanCreateRequest(actor: AuthenticatedUser): void {
    if (!this.isCustomer(actor)) {
      throw new ForbiddenException(
        'Only customers can submit a service request',
      );
    }
  }

  private assertCanAssignRequest(actor: AuthenticatedUser): void {
    const allowed = ['Admin', 'Manager'];
    if (!allowed.some((role) => actor.roles.includes(role))) {
      throw new ForbiddenException(
        'Admin or Manager role required to assign a request',
      );
    }
  }

  private assertCanUpdateStatus(actor: AuthenticatedUser): void {
    const allowed = ['Admin', 'Manager', 'SupportAgent'];
    if (!allowed.some((role) => actor.roles.includes(role))) {
      throw new ForbiddenException(
        'Admin, Manager, or SupportAgent role required to update the request status',
      );
    }
  }

  private assertCanAccessRequest(
    actor: AuthenticatedUser,
    request: ServiceRequest,
  ): void {
    if (this.isCustomer(actor)) {
      const customer = request.customer;
      if (!customer || customer.user.id !== actor.userId) {
        throw new ForbiddenException(
          'Customers can only access their own service requests',
        );
      }
    }
  }

  private assertCustomer(actor: AuthenticatedUser): void {
    if (!this.isCustomer(actor)) {
      throw new ForbiddenException('Customer role required');
    }
  }

  private async findSpecificEligibleAgent(
    agentId: number,
    request: ServiceRequest,
    userRepository: Repository<User>,
    roleRepository: Repository<Role>,
    userRoleRepository: Repository<UserRole>,
    requestRepository: Repository<ServiceRequest>,
  ): Promise<User | null> {
    const agent = await userRepository.findOne({
      where: { id: agentId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!agent) {
      throw new NotFoundException(`Support agent with id ${agentId} not found`);
    }

    const hasSupportAgentRole = await this.userHasRole(
      agentId,
      'SupportAgent',
      userRoleRepository,
      roleRepository,
    );

    if (!hasSupportAgentRole) {
      throw new ForbiddenException('Selected user is not a support agent');
    }

    await this.assertEligibleAgent(agent, request.service.category, requestRepository);
    return agent;
  }

  private async findBestEligibleAgent(
    request: ServiceRequest,
    userRepository: Repository<User>,
    roleRepository: Repository<Role>,
    userRoleRepository: Repository<UserRole>,
    requestRepository: Repository<ServiceRequest>,
  ): Promise<User | null> {
    const supportAgentRole = await roleRepository.findOne({
      where: { name: 'SupportAgent' },
    });

    if (!supportAgentRole) {
      return null;
    }

    const userAssignments = await userRoleRepository.find({
      where: { role: { id: supportAgentRole.id } },
      relations: { user: true },
    });

    const candidates = userAssignments
      .map((assignment) => assignment.user)
      .filter((user) => user && user.isActive && user.isAvailable);

    let bestAgent: User | null = null;
    let bestWorkload = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      if (!this.isAgentCategoryEligible(candidate, request.service.category)) {
        continue;
      }

      const workload = await requestRepository.count({
        where: {
          assignedToUserId: candidate.id,
          status: Not(In([ServiceRequestStatus.CLOSED])),
        },
      });

      if (workload < bestWorkload) {
        bestAgent = candidate;
        bestWorkload = workload;
      }
    }

    return bestAgent;
  }

  private async userHasRole(
    userId: number,
    roleName: string,
    userRoleRepository: Repository<UserRole>,
    roleRepository: Repository<Role>,
  ): Promise<boolean> {
    const role = await roleRepository.findOne({ where: { name: roleName } });
    if (!role) {
      return false;
    }

    const assignment = await userRoleRepository.findOne({
      where: { user: { id: userId }, role: { id: role.id } },
      relations: { user: true, role: true },
    });

    return !!assignment;
  }

  private async assertEligibleAgent(
    agent: User,
    category: string,
    requestRepository: Repository<ServiceRequest>,
  ): Promise<void> {
    if (!agent.isActive) {
      throw new ConflictException('Selected support agent is inactive');
    }

    if (!agent.isAvailable) {
      throw new ConflictException('Selected support agent is currently unavailable');
    }

    if (!this.isAgentCategoryEligible(agent, category)) {
      throw new ConflictException(
        `Support agent is not eligible for the ${category} service category`,
      );
    }

  }

  private isAgentCategoryEligible(agent: User, category: string): boolean {
    if (!agent.supportCategories) {
      return false;
    }

    const normalizedCategory = category.trim().toLowerCase();
    const categories = agent.supportCategories
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    return categories.includes(normalizedCategory);
  }

  private isCustomer(actor: AuthenticatedUser): boolean {
    return actor.roles.includes('Customer');
  }

  private assertValidId(id: number): void {
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('Request ID must be a positive integer');
    }
  }

  private toResponse(request: ServiceRequest): ServiceRequestResponseDto {
    return {
      id: request.id,
      customerId: request.customerId,
      serviceId: request.serviceId,
      description: request.description,
      status: request.status,
      assignedToUserId: request.assignedToUserId ?? null,
      assignedAt: request.assignedAt ?? null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }
}
