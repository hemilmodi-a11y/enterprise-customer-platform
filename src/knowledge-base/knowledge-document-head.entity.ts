import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('knowledge_document_heads')
export class KnowledgeDocumentHead {
  @PrimaryColumn({ type: 'char', length: 36, name: 'document_id' })
  documentId: string;

  @Column({ type: 'int', unsigned: true, name: 'latest_version' })
  latestVersion: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;
}
