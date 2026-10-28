import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Customer } from '../customers/customer.entity';
import { CatalogService } from '../services/catalog-service.entity';
import { User } from '../users/user.entity';
import { ServiceRequestStatus } from './service-request-status.enum';
import { ServiceRequestPriority } from './service-request-priority.enum';

@Entity('service_requests')
@Index('IDX_service_requests_customer_status', ['customerId', 'status'])
@Index('IDX_service_requests_service_status', ['serviceId', 'status'])
@Index('IDX_service_requests_assignee_status', ['assignedToUserId', 'status'])
@Index('IDX_service_requests_agent_priority_status_created', [
  'assignedToUserId',
  'priority',
  'status',
  'createdAt',
])
@Index('IDX_service_requests_created_at', ['createdAt'])
@Index(
  'UQ_service_requests_customer_idempotency_key',
  ['customerId', 'idempotencyKey'],
  { unique: true },
)
export class ServiceRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'customer_id' })
  customerId: number;

  @ManyToOne(() => Customer, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ type: 'int', name: 'service_id' })
  serviceId: number;

  @ManyToOne(() => CatalogService, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'service_id' })
  service: CatalogService;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'varchar',
    length: 128,
    name: 'idempotency_key',
    nullable: true,
  })
  idempotencyKey: string | null;

  @Column({
    type: 'enum',
    enum: ServiceRequestStatus,
    default: ServiceRequestStatus.SUBMITTED,
  })
  status: ServiceRequestStatus;

  @Column({
    type: 'enum',
    enum: ServiceRequestPriority,
    default: ServiceRequestPriority.NORMAL,
  })
  priority: ServiceRequestPriority;

  @Column({ type: 'int', name: 'assigned_to_user_id', nullable: true })
  assignedToUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_to_user_id' })
  assignedToUser: User | null;

  @Column({ name: 'assigned_at', type: 'datetime', nullable: true })
  assignedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
