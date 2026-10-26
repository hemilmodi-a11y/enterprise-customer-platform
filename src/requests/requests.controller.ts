import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
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
import {
  RequestAttachmentDownloadDto,
  RequestAttachmentResponseDto,
} from './dto/request-attachment-response.dto';
import { RequestAttachmentsService } from './request-attachments.service';
import { RequestsService } from './requests.service';

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@ApiTags('requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/requests')
export class RequestsController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly attachmentsService: RequestAttachmentsService,
  ) {}

  @Post()
  @Roles('Customer')
  @ApiOperation({ summary: 'Create a service request' })
  @ApiCreatedResponse({ type: ServiceRequestResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request payload' })
  @ApiForbiddenResponse({ description: 'Customer role required' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  create(@Body() dto: CreateRequestDto, @Req() request: AuthenticatedRequest) {
    return this.requestsService.create(dto, request.user);
  }

  @Get()
  @Roles('Customer', 'Admin', 'Manager', 'SupportAgent')
  @ApiOperation({ summary: 'List requests with pagination and filters' })
  @ApiOkResponse({ type: PaginatedRequestsResponseDto })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 1000000,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'Submitted',
      'Assigned',
      'In Progress',
      'Pending Customer',
      'Resolved',
      'Closed',
    ],
  })
  @ApiQuery({ name: 'serviceId', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'updatedAt', 'status', 'serviceId'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  list(
    @Query() query: ListRequestsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requestsService.list(query, request.user);
  }

  @Get('my')
  @Roles('Customer')
  @ApiOperation({
    summary: 'List the authenticated customer’s service requests',
  })
  @ApiOkResponse({ type: PaginatedRequestsResponseDto })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 1000000,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'Submitted',
      'Assigned',
      'In Progress',
      'Pending Customer',
      'Resolved',
      'Closed',
    ],
  })
  @ApiQuery({ name: 'serviceId', required: false, type: Number, minimum: 1 })
  @ApiQuery({ name: 'search', required: false, type: String, maxLength: 100 })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'updatedAt', 'status', 'serviceId'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiBadRequestResponse({ description: 'Invalid list query' })
  myRequests(
    @Query() query: ListRequestsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requestsService.listMy(request.user, query);
  }

  @Get(':id')
  @Roles('Customer', 'Admin', 'Manager', 'SupportAgent')
  @ApiOperation({ summary: 'Get a service request by ID' })
  @ApiOkResponse({ type: ServiceRequestResponseDto })
  @ApiNotFoundResponse({ description: 'Request not found' })
  @ApiForbiddenResponse({
    description: 'The current user cannot access this request',
  })
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
  @ApiBadRequestResponse({
    description: 'Invalid status or invalid transition',
  })
  @ApiForbiddenResponse({
    description: 'Not authorized to perform status changes',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRequestStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requestsService.updateStatus(id, dto, request.user);
  }

  @Post(':id/assign')
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
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

  @Post(':id/attachments')
  @Roles('Customer', 'Admin', 'Manager', 'SupportAgent')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES, files: 1 },
    }),
  )
  @ApiOperation({ summary: 'Upload a document to a service request' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: RequestAttachmentResponseDto })
  @ApiBadRequestResponse({
    description: 'Missing file, unsupported format, or content mismatch',
  })
  @ApiResponse({ status: 413, description: 'Document exceeds 10 MB' })
  @ApiForbiddenResponse({ description: 'Not authorized for this request' })
  @ApiNotFoundResponse({ description: 'Service request not found' })
  @ApiResponse({
    status: 503,
    description: 'Private document storage is unavailable or unconfigured',
  })
  uploadAttachment(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attachmentsService.upload(id, file, request.user);
  }

  @Get(':id/attachments')
  @Roles('Customer', 'Admin', 'Manager', 'SupportAgent')
  @ApiOperation({ summary: 'List request document metadata' })
  @ApiOkResponse({ type: RequestAttachmentResponseDto, isArray: true })
  @ApiForbiddenResponse({ description: 'Not authorized for this request' })
  @ApiNotFoundResponse({ description: 'Service request not found' })
  listAttachments(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attachmentsService.list(id, request.user);
  }

  @Get(':id/attachments/:attachmentId/download')
  @Roles('Customer', 'Admin', 'Manager', 'SupportAgent')
  @ApiOperation({
    summary:
      'Create a short-lived authorized download URL for a request document',
  })
  @ApiOkResponse({ type: RequestAttachmentDownloadDto })
  @ApiParam({ name: 'attachmentId', type: Number })
  @ApiForbiddenResponse({ description: 'Not authorized for this request' })
  @ApiNotFoundResponse({ description: 'Document not found' })
  @ApiResponse({
    status: 503,
    description: 'Private document storage is unavailable or unconfigured',
  })
  createAttachmentDownloadUrl(
    @Param('id', ParseIntPipe) id: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attachmentsService.createDownloadUrl(
      id,
      attachmentId,
      request.user,
    );
  }
}
