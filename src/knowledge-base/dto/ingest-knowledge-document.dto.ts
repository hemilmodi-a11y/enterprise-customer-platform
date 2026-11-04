import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

import {
  KnowledgeDocumentAccessLevel,
  KnowledgeDocumentCategory,
  KnowledgeDocumentStatus,
} from '../knowledge-document.enums';

export class IngestKnowledgeDocumentDto {
  @ApiProperty({ maxLength: 255 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: KnowledgeDocumentCategory })
  @IsEnum(KnowledgeDocumentCategory)
  category: KnowledgeDocumentCategory;

  @ApiProperty({ maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  department: string;

  @ApiPropertyOptional({ enum: KnowledgeDocumentAccessLevel })
  @IsOptional()
  @IsEnum(KnowledgeDocumentAccessLevel)
  accessLevel?: KnowledgeDocumentAccessLevel;

  @ApiPropertyOptional({ enum: KnowledgeDocumentStatus })
  @IsOptional()
  @IsEnum(KnowledgeDocumentStatus)
  status?: KnowledgeDocumentStatus;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(5000)
  description?: string;
}

export const MAX_KNOWLEDGE_SOURCE_FILE_BYTES = 10 * 1024 * 1024;
