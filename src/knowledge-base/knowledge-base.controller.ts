import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateKnowledgeDocumentDto } from './dto/create-knowledge-document.dto';
import {
  KnowledgeDocumentResponseDto,
  PaginatedKnowledgeDocumentsResponseDto,
} from './dto/knowledge-document-response.dto';
import { ListKnowledgeDocumentsQueryDto } from './dto/list-knowledge-documents-query.dto';
import { UpdateKnowledgeDocumentDto } from './dto/update-knowledge-document.dto';
import { KnowledgeBaseService } from './knowledge-base.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@ApiTags('knowledge-base')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/knowledge-base/documents')
@Roles('Admin', 'Manager', 'SupportAgent')
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Post()
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Create a knowledge document at version 1',
  })
  @ApiCreatedResponse({ type: KnowledgeDocumentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid knowledge document data' })
  @ApiForbiddenResponse({ description: 'Admin or Manager role required' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  create(
    @Body() dto: CreateKnowledgeDocumentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.knowledgeBaseService.create(dto, request.user);
  }

  @Get()
  @ApiOperation({
    summary: 'Search and paginate the latest visible knowledge documents',
  })
  @ApiOkResponse({ type: PaginatedKnowledgeDocumentsResponseDto })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'accessLevel', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'updatedAt', 'name', 'category', 'department'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiBadRequestResponse({ description: 'Invalid search or pagination query' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  list(
    @Query() query: ListKnowledgeDocumentsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.knowledgeBaseService.list(query, request.user);
  }

  @Get(':documentId/versions/:version')
  @ApiOperation({ summary: 'Retrieve a specific visible document version' })
  @ApiParam({ name: 'documentId', format: 'uuid' })
  @ApiParam({ name: 'version', type: Number })
  @ApiOkResponse({ type: KnowledgeDocumentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid document ID or version' })
  @ApiNotFoundResponse({ description: 'Knowledge document version not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  findVersion(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Param('version', ParseIntPipe) version: number,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.knowledgeBaseService.findVersion(
      documentId,
      version,
      request.user,
    );
  }

  @Get(':documentId/versions')
  @ApiOperation({ summary: 'List visible versions of a knowledge document' })
  @ApiParam({ name: 'documentId', format: 'uuid' })
  @ApiOkResponse({ type: PaginatedKnowledgeDocumentsResponseDto })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiNotFoundResponse({ description: 'Knowledge document not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  listVersions(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Query() query: ListKnowledgeDocumentsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.knowledgeBaseService.listVersions(
      documentId,
      query,
      request.user,
    );
  }

  @Get(':documentId')
  @ApiOperation({ summary: 'Retrieve the latest visible knowledge document' })
  @ApiParam({ name: 'documentId', format: 'uuid' })
  @ApiOkResponse({ type: KnowledgeDocumentResponseDto })
  @ApiNotFoundResponse({ description: 'Knowledge document not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  findLatest(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.knowledgeBaseService.findLatest(documentId, request.user);
  }

  @Patch(':documentId')
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Create a new immutable version of a knowledge document',
  })
  @ApiParam({ name: 'documentId', format: 'uuid' })
  @ApiOkResponse({ type: KnowledgeDocumentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid or empty version update' })
  @ApiConflictResponse({ description: 'Document version limit reached' })
  @ApiForbiddenResponse({ description: 'Admin or Manager role required' })
  @ApiNotFoundResponse({ description: 'Knowledge document not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  createVersion(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Body() dto: UpdateKnowledgeDocumentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.knowledgeBaseService.createVersion(
      documentId,
      dto,
      request.user,
    );
  }
}
