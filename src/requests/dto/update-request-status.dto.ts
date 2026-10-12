import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { ServiceRequestStatus } from '../service-request-status.enum';

export class UpdateRequestStatusDto {
  @ApiProperty({ enum: ServiceRequestStatus })
  @IsEnum(ServiceRequestStatus)
  status: ServiceRequestStatus;
}
