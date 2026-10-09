import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerUserResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  isActive: boolean;
}

export class CustomerResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ type: CustomerUserResponseDto })
  user: CustomerUserResponseDto;

  @ApiPropertyOptional({ type: String, nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  companyName: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  address: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedCustomersResponseDto {
  @ApiProperty({ type: [CustomerResponseDto] })
  items: CustomerResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
