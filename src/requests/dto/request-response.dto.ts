import { ApiProperty } from '@nestjs/swagger';

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
