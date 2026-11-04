import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import {
  ApiBody,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  CreateKnowledgeDocumentDto,
  isKnowledgeSourceMimeType,
} from './dto/create-knowledge-document.dto';
import {
  KnowledgeDocumentResponseDto,
  PaginatedKnowledgeDocumentsResponseDto,
} from './dto/knowledge-document-response.dto';
import { ListKnowledgeDocumentsQueryDto } from './dto/list-knowledge-documents-query.dto';
import { UpdateKnowledgeDocumentDto } from './dto/update-knowledge-document.dto';
import {
  IngestKnowledgeDocumentDto,
  MAX_KNOWLEDGE_SOURCE_FILE_BYTES,
} from './dto/ingest-knowledge-document.dto';
import { KnowledgeDocumentIndexResponseDto } from './dto/knowledge-document-index-response.dto';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeDocumentTextExtractorService } from './knowledge-document-text-extractor.service';
import { KnowledgeIndexingService } from './knowledge-indexing.service';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@ApiTags('knowledge-base')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/knowledge-base/documents')
@Roles('Admin', 'Manager', 'SupportAgent')
export class KnowledgeBaseController {
  constructor(
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly indexingService: KnowledgeIndexingService,
    private readonly textExtractor: KnowledgeDocumentTextExtractorService,
  ) {}

  @Post()
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Create a knowledge document at version 1',
  })
  @ApiCreatedResponse({ type: KnowledgeDocumentResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid knowledge document data' })
  @ApiForbiddenResponse({ description: 'Admin or Manager role required' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async create(
    @Body() dto: CreateKnowledgeDocumentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const document = await this.knowledgeBaseService.create(dto, request.user);
    await this.indexingService.indexDocument(document);
    return document;
  }

  @Post('ingest')
  @Roles('Admin', 'Manager')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_KNOWLEDGE_SOURCE_FILE_BYTES, files: 1 },
    }),
  )
  @ApiOperation({
    summary: 'Extract, create, and index a knowledge document from a file',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'category', 'department', 'file'],
      properties: {
        name: { type: 'string', maxLength: 255 },
        category: { type: 'string' },
        department: { type: 'string', maxLength: 100 },
        accessLevel: { type: 'string' },
        status: { type: 'string' },
        description: { type: 'string', maxLength: 5000 },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: KnowledgeDocumentResponseDto })
  @ApiBadRequestResponse({
    description:
      'Missing file, unsupported format, invalid signature, or no text',
  })
  @ApiResponse({
    status: 413,
    description: 'Knowledge source file exceeds 10 MB',
  })
  @ApiForbiddenResponse({ description: 'Admin or Manager role required' })
  async ingestFile(
    @Body() dto: IngestKnowledgeDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('Knowledge source file is required');
    }
    const fileName = (
      file.originalname.replace(/\\/g, '/').split('/').pop() ??
      'knowledge-document'
    )
      .replace(/[^\p{L}\p{N}._-]/gu, '_')
      .slice(0, 255);
    const content = await this.textExtractor.extract(
      file.buffer,
      fileName,
      file.mimetype,
    );
    if (!isKnowledgeSourceMimeType(file.mimetype)) {
      throw new BadRequestException('Unsupported knowledge document format');
    }
    const document = await this.knowledgeBaseService.create(
      {
        ...dto,
        mimeType: file.mimetype,
        fileName,
        content,
      },
      request.user,
    );
    await this.indexingService.indexDocument(document);
    return document;
  }

  @Post(':documentId/index')
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Re-index the latest knowledge-document version',
  })
  @ApiOkResponse({ type: KnowledgeDocumentIndexResponseDto })
  @ApiParam({ name: 'documentId', format: 'uuid' })
  @ApiNotFoundResponse({ description: 'Knowledge document not found' })
  @ApiResponse({ status: 429, description: 'Embedding provider rate limit' })
  @ApiResponse({
    status: 503,
    description: 'Embedding provider or vector store is unavailable',
  })
  @ApiResponse({ status: 504, description: 'Embedding or Qdrant timeout' })
  async reindexDocument(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const document = await this.knowledgeBaseService.findLatest(
      documentId,
      request.user,
    );
    return this.indexingService.indexDocument(document);
  }

  @Get(':documentId/index-status')
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get indexing status for a knowledge document' })
  @ApiOkResponse({ type: KnowledgeDocumentIndexResponseDto })
  @ApiParam({ name: 'documentId', format: 'uuid' })
  @ApiNotFoundResponse({ description: 'Index status is not available' })
  getIndexStatus(@Param('documentId', new ParseUUIDPipe()) documentId: string) {
    return this.indexingService.getIndexStatus(documentId);
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
  async createVersion(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Body() dto: UpdateKnowledgeDocumentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const document = await this.knowledgeBaseService.createVersion(
      documentId,
      dto,
      request.user,
    );
    await this.indexingService.indexDocument(document);
    return document;
  }
}
