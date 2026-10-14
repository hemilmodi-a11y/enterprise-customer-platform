import { ApiProperty } from '@nestjs/swagger';

import { ServiceRequestPriority } from '../service-request-priority.enum';
import { ServiceRequestStatus } from '../service-request-status.enum';

export class HighPriorityAgentRequestDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  serviceId: number;

  @ApiProperty({ enum: ServiceRequestStatus })
  status: ServiceRequestStatus;

  @ApiProperty({ enum: ServiceRequestPriority })
  priority: ServiceRequestPriority;

  @ApiProperty({ type: Number, nullable: true })
  assignedToUserId: number | null;

  @ApiProperty({ type: Date, nullable: true })
  assignedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedAgentRequestsResponseDto {
  @ApiProperty({ type: [HighPriorityAgentRequestDto] })
  items: HighPriorityAgentRequestDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
