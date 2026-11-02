import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';

import {
  KnowledgeDocumentAccessLevel,
  KnowledgeDocumentCategory,
  KnowledgeDocumentStatus,
} from '../knowledge-document.enums';
import { MAX_KNOWLEDGE_CONTENT_LENGTH } from './create-knowledge-document.dto';

const KNOWLEDGE_SOURCE_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export class UpdateKnowledgeDocumentDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ enum: KnowledgeDocumentCategory })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(KnowledgeDocumentCategory)
  category?: KnowledgeDocumentCategory;

  @ApiPropertyOptional({ maxLength: 100 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional({ enum: KnowledgeDocumentAccessLevel })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(KnowledgeDocumentAccessLevel)
  accessLevel?: KnowledgeDocumentAccessLevel;

  @ApiPropertyOptional({ enum: KnowledgeDocumentStatus })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(KnowledgeDocumentStatus)
  status?: KnowledgeDocumentStatus;

  @ApiPropertyOptional({ enum: KNOWLEDGE_SOURCE_MIME_TYPES })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(KNOWLEDGE_SOURCE_MIME_TYPES)
  mimeType?: (typeof KNOWLEDGE_SOURCE_MIME_TYPES)[number];

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(255)
  @Matches(/^[^/\\\p{C}]+$/u)
  fileName?: string | null;

  @ApiPropertyOptional({ maxLength: MAX_KNOWLEDGE_CONTENT_LENGTH })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Length(1, MAX_KNOWLEDGE_CONTENT_LENGTH)
  content?: string;
}
