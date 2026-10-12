import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import {
  PaginatedServicesResponseDto,
  ServiceResponseDto,
} from './dto/service-response.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@ApiTags('services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @Roles('Admin', 'Manager')
  @ApiCreatedResponse({ type: ServiceResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid service data' })
  @ApiForbiddenResponse({ description: 'Admin or Manager role required' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiOperation({
    summary: 'Add a service to the catalog',
    description: 'Available to Admin and Manager roles only.',
  })
  create(@Body() dto: CreateServiceDto, @Req() request: AuthenticatedRequest) {
    return this.servicesService.create(dto, request.user);
  }

  @Get()
  @ApiOperation({
    summary: 'List services with optional search, filters, and pagination',
    description:
      'Available to any authenticated user. Inactive services are included unless filtered by status.',
  })
  @ApiOkResponse({ type: PaginatedServicesResponseDto })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({ name: 'search', required: false, type: String, maxLength: 100 })
  @ApiQuery({ name: 'category', required: false, type: String, maxLength: 100 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'inactive'],
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: [
      'createdAt',
      'updatedAt',
      'name',
      'category',
      'status',
      'slaMinutes',
    ],
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['ASC', 'DESC'],
  })
  @ApiBadRequestResponse({ description: 'Invalid list query' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  list(@Query() query: ListServicesQueryDto) {
    return this.servicesService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a service by ID' })
  @ApiOkResponse({ type: ServiceResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid service ID' })
  @ApiNotFoundResponse({ description: 'Service not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.servicesService.findById(id);
  }

  @Patch(':id')
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Update a service' })
  @ApiOkResponse({ type: ServiceResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid service fields or unexpected properties',
  })
  @ApiForbiddenResponse({ description: 'Admin or Manager role required' })
  @ApiNotFoundResponse({ description: 'Service not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.servicesService.update(id, dto, request.user);
  }

  @Delete(':id')
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Deactivate a service without deleting its record',
  })
  @ApiOkResponse({ type: ServiceResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid service ID' })
  @ApiForbiddenResponse({ description: 'Admin or Manager role required' })
  @ApiNotFoundResponse({ description: 'Service not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.servicesService.deactivate(id, request.user);
  }
}
