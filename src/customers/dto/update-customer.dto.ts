import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateCustomerDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(100)
  @IsNotEmpty()
  firstName?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(100)
  @IsNotEmpty()
  lastName?: string;

  @ApiPropertyOptional({ type: String, maxLength: 30, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 150, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  companyName?: string | null;

  @ApiPropertyOptional({ type: String, maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;
}
