import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AiClassificationStatus } from '../ai-classification-status.enum';
import { AiTicketCategory } from '../ai-ticket-category.enum';
import { ServiceRequestPriority } from '../service-request-priority.enum';
import { ServiceRequestStatus } from '../service-request-status.enum';

export class ServiceRequestResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ description: 'Customer profile ID' })
  customerId: number;

  @ApiProperty({ description: 'Service catalog ID' })
  serviceId: number;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: ServiceRequestStatus })
  status: ServiceRequestStatus;

  @ApiProperty({ enum: ServiceRequestPriority })
  priority: ServiceRequestPriority;

  @ApiPropertyOptional({ enum: AiTicketCategory, nullable: true })
  aiClassificationCategory?: AiTicketCategory | null;

  @ApiPropertyOptional({ enum: ServiceRequestPriority, nullable: true })
  aiSuggestedPriority?: ServiceRequestPriority | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 1 })
  aiClassificationConfidence?: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  aiClassificationReason?: string | null;

  @ApiPropertyOptional({ enum: AiClassificationStatus })
  aiClassificationStatus?: AiClassificationStatus;

  @ApiPropertyOptional({ type: Date, nullable: true })
  aiClassifiedAt?: Date | null;

  @ApiProperty({ type: Number, nullable: true, required: false })
  assignedToUserId: number | null;

  @ApiProperty({ type: Date, nullable: true, required: false })
  assignedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedRequestsResponseDto {
  @ApiProperty({ type: [ServiceRequestResponseDto] })
  items: ServiceRequestResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
