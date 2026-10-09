import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @Length(8, 100)
  password: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

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
