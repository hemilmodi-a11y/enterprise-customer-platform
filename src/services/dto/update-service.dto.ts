import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

import { ServiceStatus } from '../service-status.enum';

export class UpdateServiceDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  name?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Length(1, 5000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  category?: string;

  @ApiPropertyOptional({ enum: ServiceStatus })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;

  @ApiPropertyOptional({
    description: 'SLA duration in minutes.',
    minimum: 1,
    maximum: 5256000,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(5256000)
  slaMinutes?: number;
}
