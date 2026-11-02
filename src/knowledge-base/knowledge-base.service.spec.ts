import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeDocument } from './knowledge-document.entity';
import { KnowledgeDocumentHead } from './knowledge-document-head.entity';
import {
  KnowledgeDocumentAccessLevel,
  KnowledgeDocumentCategory,
  KnowledgeDocumentStatus,
} from './knowledge-document.enums';

const admin: AuthenticatedUser = {
  userId: 1,
  email: 'admin@example.test',
  roles: ['Admin'],
};

const supportAgent: AuthenticatedUser = {
  userId: 2,
  email: 'agent@example.test',
  roles: ['SupportAgent'],
};

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;
  let queryBuilder: Record<string, jest.Mock>;
  let repository: Record<string, jest.Mock>;
  let transactionRepository: Record<string, jest.Mock>;
  let headRepository: Record<string, jest.Mock>;

  const document = {
    id: 8,
    documentId: '4cb1c6d3-5179-40df-8a24-6f9fd5c413a6',
    version: 1,
    name: 'Refund policy',
    description: 'Customer refund rules',
    category: KnowledgeDocumentCategory.REFUND_POLICY,
    department: 'Customer Support',
    accessLevel: KnowledgeDocumentAccessLevel.INTERNAL,
    status: KnowledgeDocumentStatus.PUBLISHED,
    mimeType: 'text/plain',
    fileName: null,
    storageKey: null,
    content: 'Refunds are available within 30 days.',
    createdByUserId: 1,
    updatedByUserId: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  } as KnowledgeDocument;

  beforeEach(() => {
    queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(document),
      getManyAndCount: jest.fn().mockResolvedValue([[document], 1]),
    };
    repository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 9 })),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    transactionRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 9 })),
      findOne: jest.fn().mockResolvedValue(document),
    };
    headRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      findOne: jest.fn().mockResolvedValue({
        documentId: document.documentId,
        latestVersion: 1,
      }),
    };
    const dataSource = {
      getRepository: jest.fn(() => repository),
      transaction: jest.fn(async (callback) =>
        callback({
          getRepository: (entity) =>
            entity === KnowledgeDocumentHead
              ? headRepository
              : transactionRepository,
        }),
      ),
    };
    service = new KnowledgeBaseService(dataSource as never);
  });

  it('creates version 1 with validated metadata and actor ownership', async () => {
    const response = await service.create(
      {
        name: 'Refund policy',
        category: KnowledgeDocumentCategory.REFUND_POLICY,
        department: 'Customer Support',
        content: 'Refunds are available within 30 days.',
      },
      admin,
    );

    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        category: KnowledgeDocumentCategory.REFUND_POLICY,
        accessLevel: KnowledgeDocumentAccessLevel.INTERNAL,
        status: KnowledgeDocumentStatus.DRAFT,
        mimeType: 'text/plain',
        storageKey: null,
        createdByUserId: admin.userId,
        updatedByUserId: admin.userId,
      }),
    );
    expect(response.version).toBe(1);
    expect(response.content).toBe('Refunds are available within 30 days.');
  });

  it('restricts document creation to Admin and Manager roles', async () => {
    await expect(
      service.create(
        {
          name: 'Refund policy',
          category: KnowledgeDocumentCategory.REFUND_POLICY,
          department: 'Customer Support',
          content: 'Refund terms.',
        },
        supportAgent,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('creates an immutable next version and defaults edits to draft', async () => {
    const response = await service.createVersion(
      document.documentId,
      { content: 'Updated refund terms.' },
      admin,
    );

    expect(headRepository.findOne).toHaveBeenCalledWith({
      where: { documentId: document.documentId },
      lock: { mode: 'pessimistic_write' },
    });
    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: document.documentId,
        version: 2,
        name: document.name,
        content: 'Updated refund terms.',
        status: KnowledgeDocumentStatus.DRAFT,
        createdByUserId: admin.userId,
        updatedByUserId: admin.userId,
      }),
    );
    expect(headRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ latestVersion: 2 }),
    );
    expect(response.version).toBe(2);
  });

  it('rejects empty updates and missing documents', async () => {
    await expect(
      service.createVersion(document.documentId, {}, admin),
    ).rejects.toBeInstanceOf(BadRequestException);

    headRepository.findOne.mockResolvedValueOnce(null);
    await expect(
      service.createVersion(document.documentId, { name: 'Renamed' }, admin),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns paginated visible summaries without selecting document content', async () => {
    await service.list(
      {
        page: 1,
        limit: 20,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
      } as never,
      supportAgent,
    );

    expect(queryBuilder.select).toHaveBeenCalledWith(
      expect.not.arrayContaining(['document.content']),
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('NOT EXISTS'),
      expect.objectContaining({
        visibleStatus: KnowledgeDocumentStatus.PUBLISHED,
        confidentialAccess: KnowledgeDocumentAccessLevel.CONFIDENTIAL,
      }),
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'document.status = :visibleStatus',
      { visibleStatus: KnowledgeDocumentStatus.PUBLISHED },
    );
  });

  it('hides confidential and unpublished versions from support agents', async () => {
    await service.findLatest(document.documentId, supportAgent);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'document.status = :visibleStatus',
      { visibleStatus: KnowledgeDocumentStatus.PUBLISHED },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'document.accessLevel != :confidentialAccess',
      { confidentialAccess: KnowledgeDocumentAccessLevel.CONFIDENTIAL },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('archived.status = :archivedStatus'),
      { archivedStatus: KnowledgeDocumentStatus.ARCHIVED },
    );
  });
});
