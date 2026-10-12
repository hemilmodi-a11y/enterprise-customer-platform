import { ApiProperty } from '@nestjs/swagger';

import { ServiceStatus } from '../service-status.enum';

export class ServiceResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  category: string;

  @ApiProperty({ enum: ServiceStatus })
  status: ServiceStatus;

  @ApiProperty({
    description: 'SLA duration in minutes.',
  })
  slaMinutes: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedServicesResponseDto {
  @ApiProperty({ type: [ServiceResponseDto] })
  items: ServiceResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
