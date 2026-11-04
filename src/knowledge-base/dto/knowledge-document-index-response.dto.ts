import { ApiProperty } from '@nestjs/swagger';

import { KnowledgeIndexStatus } from '../knowledge-document-index.entity';

export class KnowledgeDocumentIndexResponseDto {
  @ApiProperty({ format: 'uuid' })
  documentId: string;

  @ApiProperty({ minimum: 1 })
  version: number;

  @ApiProperty({ enum: KnowledgeIndexStatus })
  status: KnowledgeIndexStatus;

  @ApiProperty({ minimum: 0 })
  chunkCount: number;

  @ApiProperty({ nullable: true })
  errorCode: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  indexedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}
