import {
  GatewayTimeoutException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';

@Injectable()
export class RagVectorStoreService {
  private readonly logger = new Logger(RagVectorStoreService.name);
  private storePromise?: Promise<QdrantVectorStore>;

  constructor(private readonly config: ConfigService) {}

  async getStore(): Promise<QdrantVectorStore> {
    if (!this.storePromise) {
      this.storePromise = this.createStore().catch((error: unknown) => {
        this.storePromise = undefined;
        throw this.toServiceError(error);
      });
    }
    return this.storePromise;
  }

  private async createStore(): Promise<QdrantVectorStore> {
    const apiKey = this.config.get<string>('AI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'The embedding provider is not configured',
      );
    }

    const embeddings = new OpenAIEmbeddings({
      apiKey,
      model: this.config.get<string>(
        'RAG_EMBEDDING_MODEL',
        'text-embedding-3-small',
      ),
      batchSize: this.config.get<number>('RAG_EMBEDDING_BATCH_SIZE', 64),
      timeout: this.config.get<number>('RAG_PROVIDER_TIMEOUT_MS', 15000),
      maxRetries: 0,
    });
    const client = new QdrantClient({
      url: this.config.get<string>('QDRANT_URL', 'http://localhost:6333'),
      apiKey: this.config.get<string>('QDRANT_API_KEY') || undefined,
      timeout: Math.ceil(
        this.config.get<number>('RAG_PROVIDER_TIMEOUT_MS', 15000) / 1000,
      ),
    });
    const store = new QdrantVectorStore(embeddings, {
      client,
      collectionName: this.config.get<string>(
        'QDRANT_COLLECTION',
        'enterprise_knowledge',
      ),
      collectionConfig: {
        vectors: {
          size: this.config.get<number>('RAG_EMBEDDING_DIMENSIONS', 1536),
          distance: 'Cosine',
        },
      },
    });
    await store.ensureCollection();
    return store;
  }

  private toServiceError(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    const status = this.providerStatus(error);
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return new HttpException(
        'The embedding provider rate limit was reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (
      error instanceof Error &&
      /timeout|timed out|abort/i.test(`${error.name} ${error.message}`)
    ) {
      this.logger.warn(
        JSON.stringify({ event: 'rag_provider_timeout', provider: 'openai' }),
      );
      return new GatewayTimeoutException(
        'The embedding or vector-store request timed out',
      );
    }

    this.logger.error(
      JSON.stringify({
        event: 'rag_dependency_failure',
        errorType: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
    return new ServiceUnavailableException(
      'The embedding provider or vector store is unavailable',
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
