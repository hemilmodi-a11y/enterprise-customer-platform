import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateCustomerDto } from './dto/create-customer.dto';
import {
  CustomerResponseDto,
  PaginatedCustomersResponseDto,
} from './dto/customer-response.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Create a customer and account',
    description:
      'Admin and Manager only. Customer accounts receive the Customer role; callers cannot assign roles.',
  })
  @ApiCreatedResponse({ type: CustomerResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid customer data' })
  @ApiConflictResponse({ description: 'Email or profile already exists' })
  @ApiForbiddenResponse({ description: 'Admin or Manager role required' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  create(@Body() dto: CreateCustomerDto, @Req() request: AuthenticatedRequest) {
    return this.customersService.create(dto, request.user);
  }

  @Get()
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'List customers with search and pagination',
    description:
      'Admin and Manager only. Customers and SupportAgents cannot list customer records.',
  })
  @ApiOkResponse({ type: PaginatedCustomersResponseDto })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    maxLength: 100,
  })
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
      'email',
      'firstName',
      'lastName',
      'companyName',
    ],
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['ASC', 'DESC'],
  })
  @ApiBadRequestResponse({ description: 'Invalid list query' })
  @ApiForbiddenResponse({ description: 'Admin or Manager role required' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  list(
    @Query() query: ListCustomersQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.customersService.list(query, request.user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a customer (Customers may access only their own profile)',
    description:
      'Admin and Manager may access any customer. Customers may access only their own profile. SupportAgent access is denied.',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid customer ID' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  findById(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.customersService.findById(id, request.user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update permitted customer profile fields',
    description:
      'Admin and Manager may update customer profiles. Customers may update only their own permitted profile fields. SupportAgent access is denied.',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid or unexpected fields' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.customersService.update(id, dto, request.user);
  }

  @Patch(':id/status')
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Activate or deactivate a customer account',
    description:
      'Admin and Manager only. Customer and SupportAgent roles cannot change account status.',
  })
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiBadRequestResponse({ description: 'isActive must be a boolean' })
  @ApiForbiddenResponse({ description: 'Admin or Manager role required' })
  @ApiNotFoundResponse({ description: 'Customer not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.customersService.updateStatus(id, dto.isActive, request.user);
  }
}
