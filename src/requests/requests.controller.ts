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
import { AssignRequestDto } from './dto/assign-request.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import {
  PaginatedRequestsResponseDto,
  ServiceRequestResponseDto,
} from './dto/request-response.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { RequestsService } from './requests.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@ApiTags('requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @Roles('Customer')
  @ApiOperation({ summary: 'Create a service request' })
  @ApiCreatedResponse({ type: ServiceRequestResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiForbiddenResponse({ description: 'Customer role required' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  create(
    @Body() dto: CreateRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requestsService.create(dto, request.user);
  }

  @Get()
  @Roles('Customer', 'Admin', 'Manager', 'SupportAgent')
  @ApiOperation({ summary: 'List requests with pagination and filters' })
  @ApiOkResponse({ type: PaginatedRequestsResponseDto })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiQuery({ name: 'status', required: false, enum: ['Submitted', 'Assigned', 'In Progress', 'Pending Customer', 'Resolved', 'Closed'] })
  @ApiQuery({ name: 'serviceId', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['createdAt', 'updatedAt', 'status', 'serviceId'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  list(@Query() query: ListRequestsQueryDto, @Req() request: AuthenticatedRequest) {
    return this.requestsService.list(query, request.user);
  }

  @Get('my')
  @Roles('Customer')
  @ApiOperation({ summary: 'List the authenticated customer’s service requests' })
  @ApiOkResponse({ type: PaginatedRequestsResponseDto })
  myRequests(@Req() request: AuthenticatedRequest) {
    return this.requestsService.listMy(request.user);
  }

  @Get(':id')
  @Roles('Customer', 'Admin', 'Manager', 'SupportAgent')
  @ApiOperation({ summary: 'Get a service request by ID' })
  @ApiOkResponse({ type: ServiceRequestResponseDto })
  @ApiNotFoundResponse({ description: 'Request not found' })
  @ApiForbiddenResponse({ description: 'The current user cannot access this request' })
  findById(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requestsService.findById(id, request.user);
  }

  @Patch(':id/status')
  @Roles('Admin', 'Manager', 'SupportAgent')
  @ApiOperation({ summary: 'Update a service request status' })
  @ApiOkResponse({ type: ServiceRequestResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid status or invalid transition' })
  @ApiForbiddenResponse({ description: 'Not authorized to perform status changes' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRequestStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requestsService.updateStatus(id, dto, request.user);
  }

  @Post(':id/assign')
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Assign a service request to a support agent' })
  @ApiOkResponse({ type: ServiceRequestResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request or target agent' })
  @ApiForbiddenResponse({ description: 'Admin or Manager role required' })
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requestsService.assign(id, dto, request.user);
  }
}
