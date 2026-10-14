import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum ServiceRequestSyncAggregateType {
  REQUEST = 'request',
  SERVICE = 'service',
}

@Entity('service_request_sync_outbox')
@Index(
  'IDX_service_request_sync_outbox_pending',
  ['processedAt', 'nextAttemptAt', 'id'],
)
export class ServiceRequestSyncOutbox {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({
    name: 'aggregate_type',
    type: 'enum',
    enum: ServiceRequestSyncAggregateType,
  })
  aggregateType: ServiceRequestSyncAggregateType;

  @Column({ name: 'aggregate_id', type: 'int', unsigned: true })
  aggregateId: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  attempts: number;

  @Column({ name: 'next_attempt_at', type: 'datetime', precision: 6 })
  nextAttemptAt: Date;

  @Column({ name: 'last_error', type: 'varchar', length: 100, nullable: true })
  lastError: string | null;

  @Column({ name: 'processed_at', type: 'datetime', precision: 6, nullable: true })
  processedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt: Date;
}
