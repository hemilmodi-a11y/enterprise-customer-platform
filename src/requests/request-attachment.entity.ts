import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

import { User } from '../users/user.entity';
import { ServiceRequest } from './service-request.entity';

@Entity('service_request_attachments')
@Index('IDX_service_request_attachments_request_created', [
  'serviceRequestId',
  'createdAt',
])
export class ServiceRequestAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', name: 'service_request_id' })
  serviceRequestId: number;

  @ManyToOne(() => ServiceRequest, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_request_id' })
  serviceRequest: ServiceRequest;

  @Column({ type: 'int', name: 'uploaded_by_user_id' })
  uploadedByUserId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedBy: User;

  @Column({ type: 'varchar', length: 255, name: 'original_file_name' })
  originalFileName: string;

  @Column({ type: 'varchar', length: 100, name: 'content_type' })
  contentType: string;

  @Column({ type: 'int', unsigned: true, name: 'size_bytes' })
  sizeBytes: number;

  @Column({
    type: 'varchar',
    length: 512,
    unique: true,
    name: 'storage_key',
  })
  storageKey: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
