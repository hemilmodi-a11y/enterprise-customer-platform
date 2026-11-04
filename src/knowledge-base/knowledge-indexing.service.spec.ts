import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Document } from '@langchain/core/documents';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { KnowledgeDocument } from './knowledge-document.entity';
import {
  KnowledgeDocumentAccessLevel,
  KnowledgeDocumentCategory,
  KnowledgeDocumentStatus,
} from './knowledge-document.enums';
import { KnowledgeIndexStatus } from './knowledge-document-index.entity';
import { KnowledgeIndexingService } from './knowledge-indexing.service';

const supportAgent: AuthenticatedUser = {
  userId: 7,
  email: 'agent@example.test',
  roles: ['SupportAgent'],
};

const document = {
  documentId: '4cb1c6d3-5179-40df-8a24-6f9fd5c413a6',
  version: 2,
  name: 'Troubleshooting',
  category: KnowledgeDocumentCategory.TROUBLESHOOTING_GUIDE,
  department: 'Support',
  accessLevel: KnowledgeDocumentAccessLevel.INTERNAL,
  status: KnowledgeDocumentStatus.PUBLISHED,
  content: 'Check the network cable.',
  fileName: 'network-guide.txt',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
} as Pick<
  KnowledgeDocument,
  | 'documentId'
  | 'version'
  | 'name'
  | 'category'
  | 'department'
  | 'accessLevel'
  | 'status'
  | 'content'
  | 'fileName'
  | 'createdAt'
>;

describe('KnowledgeIndexingService', () => {
  let service: KnowledgeIndexingService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
  };
  let knowledgeBase: { findLatestAssistantDocuments: jest.Mock };
  let chunking: { split: jest.Mock };
  let store: {
    addDocuments: jest.Mock;
    delete: jest.Mock;
    similaritySearchWithScore: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      create: jest.fn((value: object) => value),
      save: jest.fn(async (value: object) => value),
      findOneBy: jest.fn(),
    };
    knowledgeBase = {
      findLatestAssistantDocuments: jest.fn().mockResolvedValue([document]),
    };
    chunking = {
      split: jest.fn().mockResolvedValue([
        new Document({
          pageContent: document.content,
          metadata: { chunkIndex: 0 },
        }),
      ]),
    };
    store = {
      addDocuments: jest.fn(),
      delete: jest.fn(),
      similaritySearchWithScore: jest.fn(),
    };
    service = new KnowledgeIndexingService(
      repository as never,
      knowledgeBase as never,
      chunking as never,
      { getStore: jest.fn().mockResolvedValue(store) } as never,
      { get: jest.fn().mockReturnValue(0.3) } as never,
    );
  });

  it('writes published chunks with stable IDs and removes superseded versions', async () => {
    const result = await service.indexDocument(document);

    expect(store.addDocuments).toHaveBeenCalledTimes(1);
    const firstIds = store.addDocuments.mock.calls[0]?.[1] as {
      ids: string[];
    };
    expect(firstIds.ids).toHaveLength(1);
    expect(firstIds.ids[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(store.delete).toHaveBeenCalledWith({
      filter: {
        must: [
          {
            key: 'metadata.documentId',
            match: { value: document.documentId },
          },
        ],
        must_not: [
          {
            key: 'metadata.version',
            match: { value: document.version },
          },
        ],
      },
    });
    expect(result).toMatchObject({
      status: KnowledgeIndexStatus.INDEXED,
      chunkCount: 1,
      errorCode: null,
    });
  });

  it('filters vector search by published access and verifies current MySQL versions', async () => {
    store.similaritySearchWithScore.mockResolvedValue([
      [
        new Document({
          pageContent: document.content,
          metadata: {
            documentId: document.documentId,
            documentName: document.name,
            category: document.category,
            department: document.department,
            version: document.version,
            chunkIndex: 0,
            sourceReference: document.fileName,
          },
        }),
        0.81,
      ],
      [new Document({ pageContent: 'low relevance', metadata: {} }), 0.1],
    ]);

    const results = await service.searchForAssistant(
      'network connection',
      supportAgent,
      5,
    );

    expect(store.similaritySearchWithScore).toHaveBeenCalledWith(
      'network connection',
      20,
      {
        must: [
          {
            key: 'metadata.status',
            match: { value: KnowledgeDocumentStatus.PUBLISHED },
          },
          {
            key: 'metadata.accessLevel',
            match: { any: ['PUBLIC', 'INTERNAL', 'RESTRICTED'] },
          },
        ],
      },
    );
    expect(knowledgeBase.findLatestAssistantDocuments).toHaveBeenCalledWith(
      [document.documentId],
      supportAgent,
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      documentId: document.documentId,
      version: document.version,
      content: document.content,
      similarity: 0.81,
    });
  });

  it('rejects callers outside the assistant roles before querying vectors', async () => {
    await expect(
      service.searchForAssistant('question', {
        ...supportAgent,
        roles: ['Admin'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(store.similaritySearchWithScore).not.toHaveBeenCalled();
  });

  it('drops stale vector versions that are no longer current in MySQL', async () => {
    knowledgeBase.findLatestAssistantDocuments.mockResolvedValue([
      { ...document, version: document.version + 1 },
    ]);
    store.similaritySearchWithScore.mockResolvedValue([
      [
        new Document({
          pageContent: document.content,
          metadata: {
            documentId: document.documentId,
            documentName: document.name,
            category: document.category,
            department: document.department,
            version: document.version,
            chunkIndex: 0,
            sourceReference: document.fileName,
          },
        }),
        0.81,
      ],
    ]);

    await expect(
      service.searchForAssistant('network connection', supportAgent, 5),
    ).resolves.toEqual([]);
  });
});
