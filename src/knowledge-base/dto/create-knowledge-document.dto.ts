import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Matches,
} from 'class-validator';

import {
  KnowledgeDocumentAccessLevel,
  KnowledgeDocumentCategory,
  KnowledgeDocumentStatus,
} from '../knowledge-document.enums';

export const MAX_KNOWLEDGE_CONTENT_LENGTH = 100_000;

export const KNOWLEDGE_SOURCE_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export type KnowledgeSourceMimeType =
  (typeof KNOWLEDGE_SOURCE_MIME_TYPES)[number];

export function isKnowledgeSourceMimeType(
  mimeType: string,
): mimeType is KnowledgeSourceMimeType {
  return KNOWLEDGE_SOURCE_MIME_TYPES.some(
    (supportedMimeType) => supportedMimeType === mimeType,
  );
}

export class CreateKnowledgeDocumentDto {
  @ApiProperty({ maxLength: 255, example: 'Customer Refund Policy' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiProperty({ enum: KnowledgeDocumentCategory })
  @IsEnum(KnowledgeDocumentCategory)
  category: KnowledgeDocumentCategory;

  @ApiProperty({ maxLength: 100, example: 'Customer Support' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  department: string;

  @ApiPropertyOptional({
    enum: KnowledgeDocumentAccessLevel,
    default: KnowledgeDocumentAccessLevel.INTERNAL,
  })
  @IsOptional()
  @IsEnum(KnowledgeDocumentAccessLevel)
  accessLevel?: KnowledgeDocumentAccessLevel;

  @ApiPropertyOptional({
    enum: KnowledgeDocumentStatus,
    default: KnowledgeDocumentStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(KnowledgeDocumentStatus)
  status?: KnowledgeDocumentStatus;

  @ApiPropertyOptional({
    enum: KNOWLEDGE_SOURCE_MIME_TYPES,
    default: 'text/plain',
  })
  @IsOptional()
  @IsIn(KNOWLEDGE_SOURCE_MIME_TYPES)
  mimeType?: KnowledgeSourceMimeType;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[^/\\\p{C}]+$/u)
  fileName?: string | null;

  @ApiProperty({
    maxLength: MAX_KNOWLEDGE_CONTENT_LENGTH,
    description:
      'Text used for knowledge retrieval. Binary source files are not uploaded by this API.',
  })
  @IsString()
  @Length(1, MAX_KNOWLEDGE_CONTENT_LENGTH)
  content: string;
}
