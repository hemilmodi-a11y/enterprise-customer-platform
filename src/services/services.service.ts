import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CatalogService } from './catalog-service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { ServiceResponseDto } from './dto/service-response.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceStatus } from './service-status.enum';

const SORT_COLUMNS = {
  createdAt: 'service.createdAt',
  updatedAt: 'service.updatedAt',
  name: 'service.name',
  category: 'service.category',
  status: 'service.status',
  slaMinutes: 'service.slaMinutes',
} as const;

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(CatalogService)
    private readonly servicesRepository: Repository<CatalogService>,
  ) {}

  async create(dto: CreateServiceDto, actor: AuthenticatedUser) {
    this.assertAdministrator(actor);
    const service = this.servicesRepository.create({
      name: dto.name,
      description: dto.description,
      category: dto.category,
      status: dto.status ?? ServiceStatus.ACTIVE,
      slaMinutes: dto.slaMinutes,
    });
    return this.toResponse(await this.servicesRepository.save(service));
  }

  async list(query: ListServicesQueryDto) {
    const queryBuilder = this.servicesRepository.createQueryBuilder('service');
    this.applyFilters(queryBuilder, query);

    const sortColumn = Object.hasOwn(SORT_COLUMNS, query.sortBy)
      ? SORT_COLUMNS[query.sortBy]
      : undefined;
    if (!sortColumn) {
      throw new BadRequestException('Unsupported service sort field');
    }

    queryBuilder
      .orderBy(sortColumn, query.sortOrder)
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [services, total] = await queryBuilder.getManyAndCount();

    return {
      items: services.map((service) => this.toResponse(service)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findById(id: number): Promise<ServiceResponseDto> {
    this.assertValidId(id);
    const service = await this.servicesRepository.findOne({
      where: { id },
    });
    if (!service) {
      throw new NotFoundException(`Service with id ${id} not found`);
    }
    return this.toResponse(service);
  }

  async update(
    id: number,
    dto: UpdateServiceDto,
    actor: AuthenticatedUser,
  ): Promise<ServiceResponseDto> {
    this.assertAdministrator(actor);
    this.assertValidId(id);
    const service = await this.getServiceOrThrow(id);

    if (dto.name !== undefined) service.name = dto.name;
    if (dto.description !== undefined) service.description = dto.description;
    if (dto.category !== undefined) service.category = dto.category;
    if (dto.status !== undefined) service.status = dto.status;
    if (dto.slaMinutes !== undefined) service.slaMinutes = dto.slaMinutes;

    return this.toResponse(await this.servicesRepository.save(service));
  }

  async deactivate(
    id: number,
    actor: AuthenticatedUser,
  ): Promise<ServiceResponseDto> {
    this.assertAdministrator(actor);
    this.assertValidId(id);
    const service = await this.getServiceOrThrow(id);
    service.status = ServiceStatus.INACTIVE;
    return this.toResponse(await this.servicesRepository.save(service));
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<CatalogService>,
    query: ListServicesQueryDto,
  ): void {
    if (query.category) {
      queryBuilder.andWhere('service.category = :category', {
        category: query.category,
      });
    }
    if (query.status) {
      queryBuilder.andWhere('service.status = :status', {
        status: query.status,
      });
    }
    if (query.search) {
      queryBuilder.andWhere(
        `(
          LOWER(service.name) LIKE :search OR
          LOWER(service.description) LIKE :search OR
          LOWER(service.category) LIKE :search
        )`,
        { search: `%${query.search.toLowerCase()}%` },
      );
    }
  }

  private async getServiceOrThrow(id: number): Promise<CatalogService> {
    const service = await this.servicesRepository.findOne({
      where: { id },
    });
    if (!service) {
      throw new NotFoundException(`Service with id ${id} not found`);
    }
    return service;
  }

  private assertAdministrator(actor: AuthenticatedUser): void {
    if (!actor.roles.includes('Admin') && !actor.roles.includes('Manager')) {
      throw new ForbiddenException(
        'Admin or Manager role is required to modify the service catalog',
      );
    }
  }

  private assertValidId(id: number): void {
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('Service ID must be a positive integer');
    }
  }

  private toResponse(service: CatalogService): ServiceResponseDto {
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      category: service.category,
      status: service.status,
      slaMinutes: service.slaMinutes,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }
}
