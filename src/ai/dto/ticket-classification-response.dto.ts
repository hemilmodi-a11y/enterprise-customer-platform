import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { AiTicketCategory } from '../../requests/ai-ticket-category.enum';
import { ServiceRequestPriority } from '../../requests/service-request-priority.enum';

export class TicketClassificationResponseDto {
  @ApiProperty({ enum: AiTicketCategory })
  @IsEnum(AiTicketCategory)
  category: AiTicketCategory;

  @ApiProperty({ enum: ServiceRequestPriority })
  @IsEnum(ServiceRequestPriority)
  priority: ServiceRequestPriority;

  @ApiProperty({ minimum: 0, maximum: 1, example: 0.95 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  confidence: number;

  @ApiProperty({ maxLength: 500 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}
