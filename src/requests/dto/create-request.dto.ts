import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

import { ServiceRequestPriority } from '../service-request-priority.enum';

export class CreateRequestDto {
  @ApiProperty({ minimum: 1, example: 5, description: 'Service ID' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serviceId: number;

  @ApiProperty({
    example: 'We need internet connectivity restored at the branch office.',
    minLength: 10,
    maxLength: 5000,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Length(10, 5000)
  description: string;

  @ApiPropertyOptional({
    enum: ServiceRequestPriority,
    default: ServiceRequestPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(ServiceRequestPriority)
  priority?: ServiceRequestPriority;
}
