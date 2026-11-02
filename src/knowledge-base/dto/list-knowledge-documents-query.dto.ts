import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  KnowledgeDocumentAccessLevel,
  KnowledgeDocumentCategory,
  KnowledgeDocumentStatus,
} from '../knowledge-document.enums';

const KNOWLEDGE_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'name',
  'category',
  'department',
] as const;

export class ListKnowledgeDocumentsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 1000000, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: KnowledgeDocumentCategory })
  @IsOptional()
  @IsEnum(KnowledgeDocumentCategory)
  category?: KnowledgeDocumentCategory;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional({ enum: KnowledgeDocumentAccessLevel })
  @IsOptional()
  @IsEnum(KnowledgeDocumentAccessLevel)
  accessLevel?: KnowledgeDocumentAccessLevel;

  @ApiPropertyOptional({ enum: KnowledgeDocumentStatus })
  @IsOptional()
  @IsEnum(KnowledgeDocumentStatus)
  status?: KnowledgeDocumentStatus;

  @ApiPropertyOptional({ enum: KNOWLEDGE_SORT_FIELDS, default: 'updatedAt' })
  @IsOptional()
  @IsIn(KNOWLEDGE_SORT_FIELDS)
  sortBy: (typeof KNOWLEDGE_SORT_FIELDS)[number] = 'updatedAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn(['ASC', 'DESC'])
  sortOrder: 'ASC' | 'DESC' = 'DESC';
}
