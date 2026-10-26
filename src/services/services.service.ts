import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { createHash } from 'crypto';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { RedisCacheService } from '../cache/redis-cache.service';
import { ServiceRequestSyncService } from '../mongodb/service-request-sync.service';
import { CatalogService } from './catalog-service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import {
  PaginatedServicesResponseDto,
  ServiceResponseDto,
} from './dto/service-response.dto';
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
const CACHE_NAMESPACE = 'service-catalog:v1';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(CatalogService)
    private readonly servicesRepository: Repository<CatalogService>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly syncService: ServiceRequestSyncService,
    private readonly cache: RedisCacheService,
    private readonly config: ConfigService,
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
    const saved = await this.servicesRepository.save(service);
    await this.cache.invalidate(CACHE_NAMESPACE);
    return this.toResponse(saved);
  }

  async list(query: ListServicesQueryDto) {
    const version = await this.cache.getVersion(CACHE_NAMESPACE);
    const cacheKey =
      version === null ? null : this.listCacheKey(version, query);
    if (cacheKey) {
      const cached =
        await this.cache.getJson<PaginatedServicesResponseDto>(cacheKey);
      if (cached) {
        return this.hydrateDates(cached);
      }
    }

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

    const response: PaginatedServicesResponseDto = {
      items: services.map((service) => this.toResponse(service)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
    if (cacheKey) {
      await this.cache.setJson(
        cacheKey,
        response,
        this.config.get<number>('CACHE_SERVICE_LIST_TTL_SECONDS', 60),
      );
    }
    return response;
  }

  async findById(id: number): Promise<ServiceResponseDto> {
    this.assertValidId(id);
    const version = await this.cache.getVersion(CACHE_NAMESPACE);
    const cacheKey = version === null ? null : this.detailCacheKey(version, id);
    if (cacheKey) {
      const cached = await this.cache.getJson<ServiceResponseDto>(cacheKey);
      if (cached) {
        return {
          ...cached,
          createdAt: new Date(cached.createdAt),
          updatedAt: new Date(cached.updatedAt),
        };
      }
    }

    const service = await this.servicesRepository.findOne({
      where: { id },
    });
    if (!service) {
      throw new NotFoundException(`Service with id ${id} not found`);
    }
    const response = this.toResponse(service);
    if (cacheKey) {
      await this.cache.setJson(
        cacheKey,
        response,
        this.config.get<number>('CACHE_SERVICE_DETAIL_TTL_SECONDS', 120),
      );
    }
    return response;
  }

  async update(
    id: number,
    dto: UpdateServiceDto,
    actor: AuthenticatedUser,
  ): Promise<ServiceResponseDto> {
    this.assertAdministrator(actor);
    this.assertValidId(id);

    const response = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(CatalogService);
      const service = await repository.findOne({ where: { id } });
      if (!service) {
        throw new NotFoundException(`Service with id ${id} not found`);
      }

      const categoryChanged =
        dto.category !== undefined && dto.category !== service.category;
      if (dto.name !== undefined) service.name = dto.name;
      if (dto.description !== undefined) service.description = dto.description;
      if (dto.category !== undefined) service.category = dto.category;
      if (dto.status !== undefined) service.status = dto.status;
      if (dto.slaMinutes !== undefined) service.slaMinutes = dto.slaMinutes;

      const saved = await repository.save(service);
      if (categoryChanged) {
        await this.syncService.enqueueService(manager, saved.id);
      }
      return this.toResponse(saved);
    });
    await this.cache.invalidate(CACHE_NAMESPACE);
    return response;
  }

  async deactivate(
    id: number,
    actor: AuthenticatedUser,
  ): Promise<ServiceResponseDto> {
    this.assertAdministrator(actor);
    this.assertValidId(id);
    const service = await this.getServiceOrThrow(id);
    service.status = ServiceStatus.INACTIVE;
    const saved = await this.servicesRepository.save(service);
    await this.cache.invalidate(CACHE_NAMESPACE);
    return this.toResponse(saved);
  }

  private listCacheKey(version: string, query: ListServicesQueryDto): string {
    const normalizedQuery = {
      page: query.page,
      limit: query.limit,
      search: query.search ?? null,
      category: query.category ?? null,
      status: query.status ?? null,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };
    const digest = createHash('sha256')
      .update(JSON.stringify(normalizedQuery))
      .digest('hex');
    return `${CACHE_NAMESPACE}:g${version}:list:${digest}`;
  }

  private detailCacheKey(version: string, id: number): string {
    return `${CACHE_NAMESPACE}:g${version}:detail:${id}`;
  }

  private hydrateDates(
    cached: PaginatedServicesResponseDto,
  ): PaginatedServicesResponseDto {
    return {
      ...cached,
      items: cached.items.map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      })),
    };
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
