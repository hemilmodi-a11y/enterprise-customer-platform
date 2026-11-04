import {
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';

import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { KnowledgeDocument } from './knowledge-document.entity';
import {
  KnowledgeDocumentIndex,
  KnowledgeIndexStatus,
} from './knowledge-document-index.entity';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeChunkingService } from '../ai/rag/knowledge-chunking.service';
import { RagVectorStoreService } from '../ai/rag/rag-vector-store.service';
import { KnowledgeDocumentStatus } from './knowledge-document.enums';

export interface KnowledgeRetrievedChunk {
  documentId: string;
  documentName: string;
  category: KnowledgeDocument['category'];
  department: string;
  version: number;
  chunkIndex: number;
  sourceReference: string;
  content: string;
  similarity: number;
}

@Injectable()
export class KnowledgeIndexingService {
  private readonly logger = new Logger(KnowledgeIndexingService.name);

  constructor(
    @InjectRepository(KnowledgeDocumentIndex)
    private readonly indexRepository: Repository<KnowledgeDocumentIndex>,
    private readonly knowledgeBase: KnowledgeBaseService,
    private readonly chunking: KnowledgeChunkingService,
    private readonly vectorStoreService: RagVectorStoreService,
    private readonly config: ConfigService,
  ) {}

  async indexDocument(
    document: Pick<
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
    >,
  ): Promise<KnowledgeDocumentIndex> {
    const state = this.indexRepository.create({
      documentId: document.documentId,
      version: document.version,
      status: KnowledgeIndexStatus.INDEXING,
      chunkCount: 0,
      errorCode: null,
      indexedAt: null,
    });
    await this.indexRepository.save(state);

    try {
      if (document.status === KnowledgeDocumentStatus.ARCHIVED) {
        const store = await this.vectorStoreService.getStore();
        const documentFilter = this.documentFilter(document.documentId);
        await store.delete({ filter: documentFilter });
        return this.saveState(state, KnowledgeIndexStatus.NOT_PUBLISHED);
      }

      if (document.status !== KnowledgeDocumentStatus.PUBLISHED) {
        return this.saveState(state, KnowledgeIndexStatus.NOT_PUBLISHED);
      }

      const chunks = await this.chunking.split(document);
      if (chunks.length === 0) {
        throw new BadRequestException(
          'Knowledge document contains no indexable text',
        );
      }
      const store = await this.vectorStoreService.getStore();
      const pointIds = chunks.map((chunk) =>
        this.pointId(
          document.documentId,
          document.version,
          chunk.metadata.chunkIndex as number,
        ),
      );
      await store.addDocuments(chunks, { ids: pointIds });
      await store.delete({
        filter: {
          ...this.documentFilter(document.documentId),
          must_not: [
            {
              key: 'metadata.version',
              match: { value: document.version },
            },
          ],
        },
      });

      state.chunkCount = chunks.length;
      state.indexedAt = new Date();
      return this.saveState(state, KnowledgeIndexStatus.INDEXED);
    } catch (error) {
      state.errorCode = this.safeErrorCode(error);
      await this.indexRepository.save(state);
      this.logger.error(
        JSON.stringify({
          event: 'knowledge_indexing_failed',
          documentId: document.documentId,
          version: document.version,
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      throw this.toServiceError(error);
    }
  }

  async getIndexStatus(documentId: string): Promise<KnowledgeDocumentIndex> {
    const state = await this.indexRepository.findOneBy({ documentId });
    if (!state) {
      throw new NotFoundException('Knowledge document has not been indexed');
    }
    return state;
  }

  async searchForAssistant(
    question: string,
    actor: AuthenticatedUser,
    limit: number,
  ): Promise<KnowledgeRetrievedChunk[]> {
    const isCustomer = actor.roles.includes('Customer');
    const isSupportAgent = actor.roles.includes('SupportAgent');
    if (!isCustomer && !isSupportAgent) {
      throw new ForbiddenException(
        'Customer or SupportAgent role required for the support assistant',
      );
    }

    if (!question.trim()) {
      return [];
    }

    try {
      const store = await this.vectorStoreService.getStore();
      const accessLevels = isCustomer
        ? ['PUBLIC']
        : ['PUBLIC', 'INTERNAL', 'RESTRICTED'];
      const candidates = await store.similaritySearchWithScore(
        question,
        Math.min(limit * 4, 80),
        {
          must: [
            {
              key: 'metadata.status',
              match: { value: KnowledgeDocumentStatus.PUBLISHED },
            },
            {
              key: 'metadata.accessLevel',
              match: { any: accessLevels },
            },
          ],
        },
      );
      const threshold = this.config.get<number>(
        'RAG_SIMILARITY_THRESHOLD',
        0.3,
      );
      const relevant = candidates.filter(([, score]) => score >= threshold);
      if (relevant.length === 0) {
        return [];
      }

      const documentIds = [
        ...new Set(
          relevant.map(([chunk]) => chunk.metadata.documentId as string),
        ),
      ];
      const currentDocuments =
        await this.knowledgeBase.findLatestAssistantDocuments(
          documentIds,
          actor,
        );
      const currentVersions = new Map(
        currentDocuments.map((document) => [
          document.documentId,
          document.version,
        ]),
      );
      const seen = new Set<string>();
      return relevant
        .flatMap(([chunk, similarity]) => {
          const metadata = chunk.metadata;
          const documentId = metadata.documentId as string;
          const version = Number(metadata.version);
          const chunkIndex = Number(metadata.chunkIndex);
          const key = `${documentId}:${version}:${chunkIndex}`;
          if (
            currentVersions.get(documentId) !== version ||
            seen.has(key) ||
            !chunk.pageContent.trim()
          ) {
            return [];
          }
          seen.add(key);
          return [
            {
              documentId,
              documentName: String(metadata.documentName),
              category: metadata.category as KnowledgeDocument['category'],
              department: String(metadata.department),
              version,
              chunkIndex,
              sourceReference: String(metadata.sourceReference),
              content: chunk.pageContent,
              similarity,
            },
          ];
        })
        .slice(0, limit);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'knowledge_retrieval_failed',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      throw this.toServiceError(error);
    }
  }

  private async saveState(
    state: KnowledgeDocumentIndex,
    status: KnowledgeIndexStatus,
  ): Promise<KnowledgeDocumentIndex> {
    state.status = status;
    state.errorCode = null;
    return this.indexRepository.save(state);
  }

  private documentFilter(documentId: string) {
    return {
      must: [
        {
          key: 'metadata.documentId',
          match: { value: documentId },
        },
      ],
    };
  }

  private pointId(documentId: string, version: number, chunkIndex: number) {
    const hash = createHash('sha256')
      .update(`${documentId}:${version}:${chunkIndex}`)
      .digest('hex')
      .slice(0, 32)
      .split('');
    hash[12] = '5';
    hash[16] = ((parseInt(hash[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
    const hex = hash.join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  private safeErrorCode(error: unknown): string {
    if (error instanceof HttpException) {
      return `HTTP_${error.getStatus()}`;
    }
    return error instanceof Error ? error.name.slice(0, 50) : 'UNKNOWN_ERROR';
  }

  private toServiceError(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }
    if (
      error instanceof Error &&
      /timeout|timed out|abort/i.test(`${error.name} ${error.message}`)
    ) {
      return new GatewayTimeoutException(
        'Embedding or vector search timed out',
      );
    }
    const status = this.providerStatus(error);
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return new HttpException(
        'The embedding provider rate limit was reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return new ServiceUnavailableException(
      'Knowledge indexing or retrieval is temporarily unavailable',
    );
  }

  private providerStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) {
      return undefined;
    }
    const record = error as {
      status?: unknown;
      statusCode?: unknown;
      response?: { status?: unknown };
    };
    const status =
      record.status ?? record.statusCode ?? record.response?.status;
    return typeof status === 'number' ? status : undefined;
  }
}
