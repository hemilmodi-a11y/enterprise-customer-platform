import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { KnowledgeDocument } from '../../knowledge-base/knowledge-document.entity';
import {
  KnowledgeDocumentAccessLevel,
  KnowledgeDocumentCategory,
  KnowledgeDocumentStatus,
} from '../../knowledge-base/knowledge-document.enums';
import { KnowledgeChunkingService } from './knowledge-chunking.service';

describe('KnowledgeChunkingService', () => {
  let service: KnowledgeChunkingService;

  beforeEach(() => {
    service = new KnowledgeChunkingService({
      get: jest.fn((key: string) =>
        key === 'RAG_CHUNK_SIZE'
          ? 200
          : key === 'RAG_CHUNK_OVERLAP'
            ? 40
            : undefined,
      ),
    } as never);
  });

  it('splits normalized text while preserving document and source metadata', async () => {
    const document = {
      documentId: '4cb1c6d3-5179-40df-8a24-6f9fd5c413a6',
      version: 3,
      name: 'Refund guidance',
      category: KnowledgeDocumentCategory.REFUND_POLICY,
      department: 'Support',
      accessLevel: KnowledgeDocumentAccessLevel.INTERNAL,
      status: KnowledgeDocumentStatus.PUBLISHED,
      content: `  ${'Refunds are available under the published policy. '.repeat(20)}\r\n\r\n`,
      fileName: 'refund-policy.txt',
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

    const chunks = await service.split(document);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.metadata).toMatchObject({
      documentId: document.documentId,
      documentName: document.name,
      category: document.category,
      department: document.department,
      version: 3,
      accessLevel: document.accessLevel,
      status: document.status,
      chunkIndex: 0,
      sourceReference: document.fileName,
    });
    expect(chunks.every((chunk) => chunk.pageContent.trim().length > 0)).toBe(
      true,
    );
  });

  it('returns no chunks for empty normalized content', async () => {
    const chunks = await service.split({
      content: ' \u0000\r\n ',
    } as KnowledgeDocument);

    expect(chunks).toEqual([]);
  });

  it('rejects invalid overlap configuration', async () => {
    const invalidService = new KnowledgeChunkingService({
      get: jest.fn((key: string) =>
        key === 'RAG_CHUNK_SIZE'
          ? 200
          : key === 'RAG_CHUNK_OVERLAP'
            ? 200
            : undefined,
      ),
    } as never);

    await expect(
      invalidService.split({ content: 'indexable text' } as KnowledgeDocument),
    ).rejects.toThrow('RAG_CHUNK_OVERLAP must be smaller than RAG_CHUNK_SIZE');
  });
});
