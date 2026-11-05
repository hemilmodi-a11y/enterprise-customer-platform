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
import { RagQueryRewriterService } from '../ai/rag/rag-query-rewriter.service';
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
    private readonly queryRewriter: RagQueryRewriterService,
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
      const { searchQuery, terms } = this.queryRewriter.rewrite(question);
      if (!terms.length) {
        return [];
      }

      const candidateCount = this.config.get<number>('RAG_CANDIDATE_K', 20);
      const store = await this.vectorStoreService.getStore();
      const accessLevels = isCustomer
        ? ['PUBLIC']
        : ['PUBLIC', 'INTERNAL', 'RESTRICTED'];
      const semanticCandidates = await store.similaritySearchWithScore(
        searchQuery,
        candidateCount,
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
      const keywordDocuments =
        await this.knowledgeBase.searchLatestAssistantDocumentsByTerms(
          terms,
          actor,
          candidateCount,
        );

      const documentIds = [
        ...new Set(
          [
            ...semanticCandidates.map(([chunk]) => chunk.metadata.documentId),
            ...keywordDocuments.map((document) => document.documentId),
          ].filter(
            (documentId): documentId is string =>
              typeof documentId === 'string',
          ),
        ),
      ];
      if (documentIds.length === 0) {
        return [];
      }
      const currentDocuments =
        await this.knowledgeBase.findLatestAssistantDocuments(
          documentIds,
          actor,
        );
      const authorizedDocuments = new Map(
        currentDocuments.map((document) => [document.documentId, document]),
      );
      const queryTerms = terms;
      const candidates = new Map<
        string,
        KnowledgeRetrievedChunk & {
          semanticScore: number;
          keywordScore: number;
        }
      >();
      const addCandidate = (
        document: KnowledgeDocument,
        chunkIndex: number,
        content: string,
        semanticScore: number,
      ) => {
        if (
          !content.trim() ||
          !Number.isInteger(chunkIndex) ||
          chunkIndex < 0
        ) {
          return;
        }
        const key = `${document.documentId}:${document.version}:${chunkIndex}`;
        const keywordScore = this.keywordScore(
          queryTerms,
          [content, document.name, document.category, document.department].join(
            ' ',
          ),
        );
        const existing = candidates.get(key);
        if (existing) {
          existing.semanticScore = Math.max(
            existing.semanticScore,
            semanticScore,
          );
          existing.keywordScore = Math.max(existing.keywordScore, keywordScore);
          return;
        }
        candidates.set(key, {
          documentId: document.documentId,
          documentName: document.name,
          category: document.category,
          department: document.department,
          version: document.version,
          chunkIndex,
          sourceReference: document.fileName ?? document.documentId,
          content,
          similarity: 0,
          semanticScore,
          keywordScore,
        });
      };

      for (const [chunk, score] of semanticCandidates) {
        const metadata = chunk.metadata;
        const documentId = metadata.documentId;
        const version = Number(metadata.version);
        const chunkIndex = Number(metadata.chunkIndex);
        if (typeof documentId !== 'string' || !Number.isInteger(version)) {
          continue;
        }
        const document = authorizedDocuments.get(documentId);
        if (!document || document.version !== version) {
          continue;
        }
        addCandidate(
          document,
          chunkIndex,
          chunk.pageContent,
          Number.isFinite(score) ? Math.max(0, Math.min(score, 1)) : 0,
        );
      }

      for (const candidateDocument of keywordDocuments) {
        const document = authorizedDocuments.get(candidateDocument.documentId);
        if (!document || document.version !== candidateDocument.version) {
          continue;
        }
        const chunks = await this.chunking.split(document);
        for (const chunk of chunks) {
          addCandidate(
            document,
            Number(chunk.metadata.chunkIndex),
            chunk.pageContent,
            0,
          );
        }
      }

      const semanticWeight = this.config.get<number>(
        'RAG_SEMANTIC_WEIGHT',
        0.7,
      );
      const keywordWeight = this.config.get<number>('RAG_KEYWORD_WEIGHT', 0.3);
      const weightTotal = semanticWeight + keywordWeight;
      if (weightTotal <= 0) {
        throw new Error('RAG hybrid weights must have a positive sum');
      }
      const threshold = this.config.get<number>(
        'RAG_SIMILARITY_THRESHOLD',
        0.3,
      );
      return [...candidates.values()]
        .map((candidate) => {
          candidate.similarity =
            (candidate.semanticScore * semanticWeight +
              candidate.keywordScore * keywordWeight) /
            weightTotal;
          return candidate;
        })
        .filter((candidate) => candidate.similarity >= threshold)
        .sort(
          (left, right) =>
            right.similarity - left.similarity ||
            right.semanticScore - left.semanticScore ||
            left.documentId.localeCompare(right.documentId) ||
            left.chunkIndex - right.chunkIndex,
        )
        .slice(0, limit)
        .map(
          ({
            documentId,
            documentName,
            category,
            department,
            version,
            chunkIndex,
            sourceReference,
            content,
            similarity,
          }) => ({
            documentId,
            documentName,
            category,
            department,
            version,
            chunkIndex,
            sourceReference,
            content,
            similarity,
          }),
        );
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

  private keywordScore(terms: string[], text: string): number {
    if (terms.length === 0) {
      return 0;
    }
    const textTerms = new Set(this.queryRewriter.extractTerms(text));
    const matchedTerms = terms.filter((term) => textTerms.has(term)).length;
    return matchedTerms / terms.length;
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
