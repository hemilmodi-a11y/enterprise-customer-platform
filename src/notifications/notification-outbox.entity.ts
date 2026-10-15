import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { NotificationType } from './notification.schema';

export interface NotificationOutboxPayload {
  recipientUserId: number;
  type: NotificationType;
  title: string;
  message: string;
  relatedServiceRequestId: number;
}

@Entity('notification_outbox')
@Index('UQ_notification_outbox_event_key', ['eventKey'], { unique: true })
@Index('IDX_notification_outbox_pending', [
  'processedAt',
  'nextAttemptAt',
  'id',
])
export class NotificationOutbox {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'event_key', type: 'varchar', length: 191 })
  eventKey: string;

  @Column({ type: 'json' })
  payload: NotificationOutboxPayload;

  @Column({ type: 'int', unsigned: true, default: 0 })
  attempts: number;

  @Column({ name: 'next_attempt_at', type: 'datetime', precision: 6 })
  nextAttemptAt: Date;

  @Column({ name: 'last_error', type: 'varchar', length: 100, nullable: true })
  lastError: string | null;

  @Column({
    name: 'processed_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  processedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;
}
