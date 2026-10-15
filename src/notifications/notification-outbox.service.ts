import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, LessThanOrEqual, Repository } from 'typeorm';

import { NotificationOutbox } from './notification-outbox.entity';
import { NotificationsService } from './notifications.service';

const BATCH_SIZE = 25;
const POLL_INTERVAL_MS = 3000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

@Injectable()
export class NotificationOutboxService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationOutboxService.name);
  private timer?: NodeJS.Timeout;
  private processing = false;

  constructor(
    @InjectRepository(NotificationOutbox)
    private readonly outboxRepository: Repository<NotificationOutbox>,
    private readonly notificationsService: NotificationsService,
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

  async enqueue(
    manager: EntityManager,
    eventKey: string,
    payload: NotificationOutbox['payload'],
  ): Promise<void> {
    await manager
      .getRepository(NotificationOutbox)
      .createQueryBuilder()
      .insert()
      .values({
        eventKey,
        payload,
        nextAttemptAt: new Date(),
      })
      .execute();
  }

  async processPending(): Promise<void> {
    if (this.processing) {
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
          await this.notificationsService.createWorkflowNotification(
            `notification-outbox:${event.id}`,
            event.payload,
          );
          await this.outboxRepository.update(event.id, {
            processedAt: new Date(),
            lastError: null,
          });
        } catch (error) {
          const attempts = event.attempts + 1;
          const delay = Math.min(
            1000 * 2 ** Math.min(attempts, 8),
            MAX_RETRY_DELAY_MS,
          );
          await this.outboxRepository.update(event.id, {
            attempts,
            nextAttemptAt: new Date(Date.now() + delay),
            lastError: this.getErrorName(error),
          });
          this.logger.error(
            `Notification outbox event ${event.id} failed; it will be retried.`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Unable to process notification outbox (${this.getErrorName(error)}).`,
      );
    } finally {
      this.processing = false;
    }
  }

  private getErrorName(error: unknown): string {
    return error instanceof Error ? error.name : 'UnknownError';
  }
}
