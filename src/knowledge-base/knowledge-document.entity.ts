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

import { User } from '../users/user.entity';
import {
  KnowledgeDocumentAccessLevel,
  KnowledgeDocumentCategory,
  KnowledgeDocumentStatus,
} from './knowledge-document.enums';

@Entity('knowledge_documents')
@Index('UQ_knowledge_documents_document_version', ['documentId', 'version'], {
  unique: true,
})
@Index('IDX_knowledge_documents_category_status', ['category', 'status'])
@Index('IDX_knowledge_documents_department_status', ['department', 'status'])
@Index('IDX_knowledge_documents_access_status', ['accessLevel', 'status'])
export class KnowledgeDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'char', length: 36, name: 'document_id' })
  documentId: string;

  @Column({ type: 'int', unsigned: true })
  version: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'varchar',
    length: 50,
  })
  category: KnowledgeDocumentCategory;

  @Column({ type: 'varchar', length: 100 })
  department: string;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'access_level',
  })
  accessLevel: KnowledgeDocumentAccessLevel;

  @Column({
    type: 'varchar',
    length: 20,
    default: KnowledgeDocumentStatus.DRAFT,
  })
  status: KnowledgeDocumentStatus;

  @Column({ type: 'varchar', length: 100, name: 'mime_type' })
  mimeType: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'file_name',
    nullable: true,
  })
  fileName: string | null;

  @Column({
    type: 'varchar',
    length: 512,
    name: 'storage_key',
    nullable: true,
  })
  storageKey: string | null;

  @Column({ type: 'mediumtext' })
  content: string;

  @Column({ type: 'int', name: 'created_by_user_id' })
  createdByUserId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User;

  @Column({ type: 'int', name: 'updated_by_user_id' })
  updatedByUserId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedBy: User;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;
}
