import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, SelectQueryBuilder } from 'typeorm';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateKnowledgeDocumentDto } from './dto/create-knowledge-document.dto';
import { KnowledgeDocumentResponseDto } from './dto/knowledge-document-response.dto';
import {
  KnowledgeDocumentSummaryDto,
  PaginatedKnowledgeDocumentsResponseDto,
} from './dto/knowledge-document-response.dto';
import { ListKnowledgeDocumentsQueryDto } from './dto/list-knowledge-documents-query.dto';
import { UpdateKnowledgeDocumentDto } from './dto/update-knowledge-document.dto';
import { KnowledgeDocument } from './knowledge-document.entity';
import { KnowledgeDocumentHead } from './knowledge-document-head.entity';
import {
  KnowledgeDocumentAccessLevel,
  KnowledgeDocumentStatus,
} from './knowledge-document.enums';

const SORT_COLUMNS = {
  createdAt: 'document.createdAt',
  updatedAt: 'document.updatedAt',
  name: 'document.name',
  category: 'document.category',
  department: 'document.department',
} as const;

const SUMMARY_COLUMNS = [
  'document.id',
  'document.documentId',
  'document.version',
  'document.name',
  'document.description',
  'document.category',
  'document.department',
  'document.accessLevel',
  'document.status',
  'document.mimeType',
  'document.fileName',
  'document.storageKey',
  'document.createdByUserId',
  'document.updatedByUserId',
  'document.createdAt',
  'document.updatedAt',
];

@Injectable()
export class KnowledgeBaseService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(
    dto: CreateKnowledgeDocumentDto,
    actor: AuthenticatedUser,
  ): Promise<KnowledgeDocumentResponseDto> {
    this.assertCanManage(actor);
    return this.dataSource.transaction(async (manager) => {
      const documentId = randomUUID();
      const headRepository = manager.getRepository(KnowledgeDocumentHead);
      const documentRepository = manager.getRepository(KnowledgeDocument);
      const head = headRepository.create({ documentId, latestVersion: 1 });
      await headRepository.save(head);

      const document = documentRepository.create({
        documentId,
        version: 1,
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category,
        department: dto.department,
        accessLevel: dto.accessLevel ?? KnowledgeDocumentAccessLevel.INTERNAL,
        status: dto.status ?? KnowledgeDocumentStatus.DRAFT,
        mimeType: dto.mimeType ?? 'text/plain',
        fileName: dto.fileName ?? null,
        storageKey: null,
        content: dto.content,
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
      });
      return this.toResponse(await documentRepository.save(document));
    });
  }

  async list(
    query: ListKnowledgeDocumentsQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedKnowledgeDocumentsResponseDto> {
    const queryBuilder = this.dataSource
      .getRepository(KnowledgeDocument)
      .createQueryBuilder('document')
      .select(SUMMARY_COLUMNS);

    this.applyLatestVisibleVersion(queryBuilder, actor);
    this.applyFilters(queryBuilder, query);

    const sortColumn = SORT_COLUMNS[query.sortBy];
    if (!sortColumn) {
      throw new BadRequestException('Unsupported knowledge sort field');
    }

    queryBuilder
      .orderBy(sortColumn, query.sortOrder)
      .addOrderBy('document.documentId', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [documents, total] = await queryBuilder.getManyAndCount();
    return {
      items: documents.map((document) => this.toSummary(document)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findLatest(
    documentId: string,
    actor: AuthenticatedUser,
  ): Promise<KnowledgeDocumentResponseDto> {
    const queryBuilder = this.dataSource
      .getRepository(KnowledgeDocument)
      .createQueryBuilder('document')
      .where('document.documentId = :documentId', { documentId });
    this.applyReadVisibility(queryBuilder, actor, 'document');

    const document = await queryBuilder
      .orderBy('document.version', 'DESC')
      .getOne();
    if (!document) {
      throw new NotFoundException('Knowledge document not found');
    }
    return this.toResponse(document);
  }

  async listVersions(
    documentId: string,
    query: Pick<ListKnowledgeDocumentsQueryDto, 'page' | 'limit'>,
    actor: AuthenticatedUser,
  ): Promise<PaginatedKnowledgeDocumentsResponseDto> {
    const queryBuilder = this.dataSource
      .getRepository(KnowledgeDocument)
      .createQueryBuilder('document')
      .select(SUMMARY_COLUMNS)
      .where('document.documentId = :documentId', { documentId });
    this.applyReadVisibility(queryBuilder, actor, 'document');

    queryBuilder
      .orderBy('document.version', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [documents, total] = await queryBuilder.getManyAndCount();
    if (total === 0) {
      throw new NotFoundException('Knowledge document not found');
    }
    return {
      items: documents.map((document) => this.toSummary(document)),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findVersion(
    documentId: string,
    version: number,
    actor: AuthenticatedUser,
  ): Promise<KnowledgeDocumentResponseDto> {
    if (!Number.isInteger(version) || version < 1) {
      throw new BadRequestException('Version must be a positive integer');
    }
    const queryBuilder = this.dataSource
      .getRepository(KnowledgeDocument)
      .createQueryBuilder('document')
      .where('document.documentId = :documentId', { documentId })
      .andWhere('document.version = :version', { version });
    this.applyReadVisibility(queryBuilder, actor, 'document');

    const document = await queryBuilder.getOne();
    if (!document) {
      throw new NotFoundException('Knowledge document version not found');
    }
    return this.toResponse(document);
  }

  async createVersion(
    documentId: string,
    dto: UpdateKnowledgeDocumentDto,
    actor: AuthenticatedUser,
  ): Promise<KnowledgeDocumentResponseDto> {
    this.assertCanManage(actor);
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one document field is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const headRepository = manager.getRepository(KnowledgeDocumentHead);
      const head = await headRepository.findOne({
        where: { documentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!head) {
        throw new NotFoundException('Knowledge document not found');
      }
      if (head.latestVersion >= 4_294_967_295) {
        throw new ConflictException('Knowledge document version limit reached');
      }

      const repository = manager.getRepository(KnowledgeDocument);
      const latest = await repository.findOne({
        where: { documentId, version: head.latestVersion },
      });
      if (!latest) {
        throw new ConflictException(
          'Knowledge document version pointer is inconsistent',
        );
      }

      const nextVersion = head.latestVersion + 1;
      const next = repository.create({
        documentId,
        version: nextVersion,
        name: dto.name ?? latest.name,
        description:
          dto.description !== undefined ? dto.description : latest.description,
        category: dto.category ?? latest.category,
        department: dto.department ?? latest.department,
        accessLevel: dto.accessLevel ?? latest.accessLevel,
        status: dto.status ?? KnowledgeDocumentStatus.DRAFT,
        mimeType: dto.mimeType ?? latest.mimeType,
        fileName: dto.fileName !== undefined ? dto.fileName : latest.fileName,
        storageKey: latest.storageKey,
        content: dto.content ?? latest.content,
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
      });
      const saved = await repository.save(next);
      head.latestVersion = nextVersion;
      await headRepository.save(head);
      return this.toResponse(saved);
    });
  }

  private applyLatestVisibleVersion(
    queryBuilder: SelectQueryBuilder<KnowledgeDocument>,
    actor: AuthenticatedUser,
  ): void {
    const visibleVersions = this.canReadConfidential(actor)
      ? ''
      : ` AND newer.status = :visibleStatus
          AND newer.access_level != :confidentialAccess`;
    const params = this.canReadConfidential(actor)
      ? {}
      : {
          visibleStatus: KnowledgeDocumentStatus.PUBLISHED,
          confidentialAccess: KnowledgeDocumentAccessLevel.CONFIDENTIAL,
        };
    queryBuilder.andWhere(
      `NOT EXISTS (
        SELECT newer.id
        FROM knowledge_documents newer
        WHERE newer.document_id = document.document_id
          AND newer.version > document.version${visibleVersions}
      )`,
      params,
    );
    this.applyReadVisibility(queryBuilder, actor, 'document');
  }

  private applyReadVisibility(
    queryBuilder: SelectQueryBuilder<KnowledgeDocument>,
    actor: AuthenticatedUser,
    alias: string,
  ): void {
    if (this.canReadConfidential(actor)) {
      return;
    }
    queryBuilder
      .andWhere(`${alias}.status = :visibleStatus`, {
        visibleStatus: KnowledgeDocumentStatus.PUBLISHED,
      })
      .andWhere(`${alias}.accessLevel != :confidentialAccess`, {
        confidentialAccess: KnowledgeDocumentAccessLevel.CONFIDENTIAL,
      })
      .andWhere(
        `NOT EXISTS (
          SELECT archived.id
          FROM knowledge_documents archived
          WHERE archived.document_id = ${alias}.document_id
            AND archived.status = :archivedStatus
            AND archived.version = (
              SELECT MAX(latest.version)
              FROM knowledge_documents latest
              WHERE latest.document_id = ${alias}.document_id
            )
        )`,
        { archivedStatus: KnowledgeDocumentStatus.ARCHIVED },
      );
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<KnowledgeDocument>,
    query: ListKnowledgeDocumentsQueryDto,
  ): void {
    if (query.category) {
      queryBuilder.andWhere('document.category = :category', {
        category: query.category,
      });
    }
    if (query.department) {
      queryBuilder.andWhere('document.department = :department', {
        department: query.department,
      });
    }
    if (query.accessLevel) {
      queryBuilder.andWhere('document.accessLevel = :accessLevel', {
        accessLevel: query.accessLevel,
      });
    }
    if (query.status) {
      queryBuilder.andWhere('document.status = :status', {
        status: query.status,
      });
    }
    if (query.search) {
      queryBuilder.andWhere(
        '(LOWER(document.name) LIKE :search OR LOWER(document.description) LIKE :search OR LOWER(document.content) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }
  }

  private assertCanManage(actor: AuthenticatedUser): void {
    if (!actor.roles.some((role) => ['Admin', 'Manager'].includes(role))) {
      throw new ForbiddenException(
        'Admin or Manager role required to manage knowledge documents',
      );
    }
  }

  private canReadConfidential(actor: AuthenticatedUser): boolean {
    return actor.roles.some((role) => ['Admin', 'Manager'].includes(role));
  }

  private toSummary(document: KnowledgeDocument): KnowledgeDocumentSummaryDto {
    return {
      id: document.id,
      documentId: document.documentId,
      version: document.version,
      name: document.name,
      description: document.description,
      category: document.category,
      department: document.department,
      accessLevel: document.accessLevel,
      status: document.status,
      mimeType: document.mimeType,
      fileName: document.fileName,
      storageKey: document.storageKey,
      createdByUserId: document.createdByUserId,
      updatedByUserId: document.updatedByUserId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  private toResponse(
    document: KnowledgeDocument,
  ): KnowledgeDocumentResponseDto {
    return {
      ...this.toSummary(document),
      content: document.content,
    };
  }
}
