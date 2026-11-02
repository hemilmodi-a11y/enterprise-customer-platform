import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  KnowledgeDocumentAccessLevel,
  KnowledgeDocumentCategory,
  KnowledgeDocumentStatus,
} from '../knowledge-document.enums';

export class KnowledgeDocumentSummaryDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ format: 'uuid' })
  documentId: string;

  @ApiProperty({ minimum: 1 })
  version: number;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ enum: KnowledgeDocumentCategory })
  category: KnowledgeDocumentCategory;

  @ApiProperty()
  department: string;

  @ApiProperty({ enum: KnowledgeDocumentAccessLevel })
  accessLevel: KnowledgeDocumentAccessLevel;

  @ApiProperty({ enum: KnowledgeDocumentStatus })
  status: KnowledgeDocumentStatus;

  @ApiProperty()
  mimeType: string;

  @ApiPropertyOptional({ nullable: true })
  fileName: string | null;

  @ApiPropertyOptional({ nullable: true })
  storageKey: string | null;

  @ApiProperty()
  createdByUserId: number;

  @ApiProperty()
  updatedByUserId: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

export class KnowledgeDocumentResponseDto extends KnowledgeDocumentSummaryDto {
  @ApiProperty({ maxLength: 100000 })
  content: string;
}

export class PaginatedKnowledgeDocumentsResponseDto {
  @ApiProperty({ type: [KnowledgeDocumentSummaryDto] })
  items: KnowledgeDocumentSummaryDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
