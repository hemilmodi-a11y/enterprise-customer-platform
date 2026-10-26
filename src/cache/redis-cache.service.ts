import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client?: Redis;
  private enabled = false;
  private lastConnectAttempt = 0;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.enabled = this.config.get<boolean>('CACHE_ENABLED', true);
    if (!this.enabled) {
      return;
    }

    const client = new Redis(
      this.config.get<string>('CACHE_REDIS_URL', 'redis://localhost:6379'),
      {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 500,
        commandTimeout: 500,
        retryStrategy: (attempt) => (attempt <= 2 ? attempt * 100 : null),
      },
    );
    this.client = client;
    client.on('error', (error: Error) => {
      this.logger.warn(
        `Redis cache unavailable (${error.name}); database reads will be used.`,
      );
    });
    this.connect(client);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }
    if (this.client.status === 'ready') {
      await this.client.quit();
      return;
    }
    this.client.disconnect();
  }

  async getJson<T>(key: string): Promise<T | null> {
    const client = await this.getReadyClient();
    if (!client) {
      return null;
    }

    try {
      const value = await client.get(key);
      return value === null ? null : (JSON.parse(value) as T);
    } catch (error) {
      this.logFailure('read', error);
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    const client = await this.getReadyClient();
    if (!client) {
      return;
    }

    try {
      await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logFailure('write', error);
    }
  }

  async getVersion(namespace: string): Promise<string | null> {
    const client = await this.getReadyClient();
    if (!client) {
      return null;
    }

    try {
      return (await client.get(this.versionKey(namespace))) ?? '0';
    } catch (error) {
      this.logFailure('read version', error);
      return null;
    }
  }

  async invalidate(namespace: string): Promise<void> {
    const client = await this.getReadyClient();
    if (!client) {
      return;
    }

    try {
      await client.incr(this.versionKey(namespace));
    } catch (error) {
      this.logFailure('invalidate', error);
    }
  }

  private versionKey(namespace: string): string {
    return `cache:${namespace}:version`;
  }

  private async getReadyClient(): Promise<Redis | null> {
    if (!this.enabled || !this.client) {
      return null;
    }

    if (this.client.status === 'ready') {
      return this.client;
    }

    if (
      this.client.status === 'end' &&
      Date.now() - this.lastConnectAttempt >= 5000
    ) {
      this.connect(this.client);
    }
    return null;
  }

  private connect(client: Redis): void {
    if (client.status !== 'wait' && client.status !== 'end') {
      return;
    }
    this.lastConnectAttempt = Date.now();
    void client.connect().catch((error: unknown) => {
      this.logFailure('connect', error);
    });
  }

  private logFailure(operation: string, error: unknown): void {
    this.logger.warn(
      `Redis cache ${operation} failed (${error instanceof Error ? error.name : 'UnknownError'}); database reads will be used.`,
    );
  }
}
