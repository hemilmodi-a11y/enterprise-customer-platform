import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Model } from 'mongoose';
import {
  DataSource,
  EntityManager,
  IsNull,
  LessThanOrEqual,
  Repository,
} from 'typeorm';

import { ServiceRequest } from '../requests/service-request.entity';
import { ServiceRequestStatus } from '../requests/service-request-status.enum';
import {
  ServiceRequestSyncAggregateType,
  ServiceRequestSyncOutbox,
} from './service-request-sync-outbox.entity';
import { ServiceRequestReadModel } from './service-request-read-model.schema';

const BATCH_SIZE = 25;
const POLL_INTERVAL_MS = 3000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

@Injectable()
export class ServiceRequestSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServiceRequestSyncService.name);
  private timer?: NodeJS.Timeout;
  private processing = false;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(ServiceRequestSyncOutbox)
    private readonly outboxRepository: Repository<ServiceRequestSyncOutbox>,
    @InjectModel(ServiceRequestReadModel.name)
    private readonly readModel: Model<ServiceRequestReadModel>,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.processPending();
    }, POLL_INTERVAL_MS);
    this.timer.unref();
    void this.processPending();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async enqueueRequest(manager: EntityManager, requestId: number): Promise<void> {
    await manager.getRepository(ServiceRequestSyncOutbox).insert({
      aggregateType: ServiceRequestSyncAggregateType.REQUEST,
      aggregateId: requestId,
      nextAttemptAt: new Date(),
    });
  }

  async enqueueService(manager: EntityManager, serviceId: number): Promise<void> {
    await manager.getRepository(ServiceRequestSyncOutbox).insert({
      aggregateType: ServiceRequestSyncAggregateType.SERVICE,
      aggregateId: serviceId,
      nextAttemptAt: new Date(),
    });
  }

  async synchronizePending(): Promise<void> {
    await this.processPending();
  }

  async assertReportingReadModelCurrent(): Promise<void> {
    let pendingCount: number;
    try {
      pendingCount = await this.outboxRepository.count({
        where: { processedAt: IsNull() },
      });
    } catch (error) {
      this.logger.error(
        `Unable to verify reporting synchronization state (${this.getErrorName(error)}).`,
      );
      throw new ServiceUnavailableException(
        'Reporting data is temporarily unavailable.',
      );
    }

    if (pendingCount > 0) {
      throw new ServiceUnavailableException(
        'Reporting data is synchronizing. Retry shortly.',
      );
    }
  }

  private async processPending(): Promise<void> {
    if (this.processing || this.readModel.db.readyState !== 1) {
      return;
    }

    this.processing = true;
    try {
      const events = await this.outboxRepository.find({
        where: {
          processedAt: IsNull(),
          nextAttemptAt: LessThanOrEqual(new Date()),
        },
        order: { id: 'ASC' },
        take: BATCH_SIZE,
      });

      for (const event of events) {
        try {
          if (event.aggregateType === ServiceRequestSyncAggregateType.REQUEST) {
            await this.syncRequest(event.aggregateId);
          } else {
            await this.syncService(event.aggregateId);
          }

          await this.outboxRepository.update(event.id, {
            processedAt: new Date(),
            lastError: null,
          });
        } catch (error) {
          const attempts = event.attempts + 1;
          const delay = Math.min(1000 * 2 ** Math.min(attempts, 8), MAX_RETRY_DELAY_MS);
          await this.outboxRepository.update(event.id, {
            attempts,
            nextAttemptAt: new Date(Date.now() + delay),
            lastError: this.getErrorName(error),
          });
          this.logger.error(
            `MongoDB read-model synchronization failed for outbox event ${event.id}; it will be retried.`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Unable to read MongoDB synchronization events (${this.getErrorName(error)}).`,
      );
    } finally {
      this.processing = false;
    }
  }

  private async syncRequest(requestId: number): Promise<void> {
    const request = await this.dataSource
      .getRepository(ServiceRequest)
      .findOne({
        where: { id: requestId },
        relations: { service: true },
      });

    if (!request) {
      await this.readModel.deleteOne({ sourceRequestId: requestId }).exec();
      return;
    }

    await this.readModel
      .updateOne(
        { sourceRequestId: request.id },
        {
          $set: {
            sourceRequestId: request.id,
            serviceCategory: request.service.category,
            status: request.status,
            requestCreatedAt: request.createdAt,
            requestUpdatedAt: request.updatedAt,
          },
        },
        { upsert: true, runValidators: true },
      )
      .exec();
  }

  private async syncService(serviceId: number): Promise<void> {
    const requests = await this.dataSource
      .getRepository(ServiceRequest)
      .createQueryBuilder('request')
      .innerJoin('request.service', 'service')
      .select('request.id', 'requestId')
      .addSelect('request.status', 'status')
      .addSelect('request.createdAt', 'requestCreatedAt')
      .addSelect('request.updatedAt', 'requestUpdatedAt')
      .addSelect('service.category', 'serviceCategory')
      .where('request.serviceId = :serviceId', { serviceId })
      .getRawMany<{
        requestId: number;
        status: ServiceRequestStatus;
        requestCreatedAt: Date;
        requestUpdatedAt: Date;
        serviceCategory: string;
      }>();

    if (requests.length === 0) {
      return;
    }

    await this.readModel.bulkWrite(
      requests.map((request) => ({
        updateOne: {
          filter: { sourceRequestId: request.requestId },
          update: {
            $set: {
              sourceRequestId: request.requestId,
              serviceCategory: request.serviceCategory,
              status: request.status,
              requestCreatedAt: request.requestCreatedAt,
              requestUpdatedAt: request.requestUpdatedAt,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  private getErrorName(error: unknown): string {
    return error instanceof Error ? error.name : 'UnknownError';
  }
}
