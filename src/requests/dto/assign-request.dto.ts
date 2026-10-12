import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class AssignRequestDto {
  @ApiPropertyOptional({
    minimum: 1,
    description: 'Target support agent user ID. If omitted, the system picks the best eligible agent.',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  agentId?: number;
}
