import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Connection } from 'mongoose';
import { DataSource } from 'typeorm';

export interface ReadinessResult {
  status: 'ok' | 'degraded';
  dependencies: {
    mysql: 'up' | 'down';
    mongodb: 'up' | 'down';
  };
}

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {}

  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  async ready(): Promise<ReadinessResult> {
    const mysql = await this.isMySqlReady();
    const mongodb = this.mongoConnection.readyState === 1;
    const result: ReadinessResult = {
      status: mysql ? 'ok' : 'degraded',
      dependencies: {
        mysql: mysql ? 'up' : 'down',
        mongodb: mongodb ? 'up' : 'down',
      },
    };

    if (!mysql) {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }

  private async isMySqlReady(): Promise<boolean> {
    if (!this.dataSource.isInitialized) {
      return false;
    }

    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('MySQL health check timed out')),
            1500,
          );
        }),
      ]);
      return true;
    } catch {
      return false;
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
