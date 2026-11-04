import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum KnowledgeIndexStatus {
  INDEXING = 'INDEXING',
  INDEXED = 'INDEXED',
  NOT_PUBLISHED = 'NOT_PUBLISHED',
  FAILED = 'FAILED',
}

@Entity('knowledge_document_indexing')
export class KnowledgeDocumentIndex {
  @PrimaryColumn({ type: 'char', length: 36, name: 'document_id' })
  documentId: string;

  @Column({ type: 'int', unsigned: true })
  version: number;

  @Column({ type: 'varchar', length: 20 })
  status: KnowledgeIndexStatus;

  @Column({ type: 'int', unsigned: true, name: 'chunk_count', default: 0 })
  chunkCount: number;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'error_code' })
  errorCode: string | null;

  @Column({ type: 'datetime', nullable: true, name: 'indexed_at' })
  indexedAt: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;
}
