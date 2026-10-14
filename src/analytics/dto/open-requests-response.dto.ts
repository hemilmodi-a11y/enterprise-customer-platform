import { ApiProperty } from '@nestjs/swagger';

export class OpenRequestsByCategoryItemDto {
  @ApiProperty()
  category: string;

  @ApiProperty({ description: 'Number of open requests in this category.' })
  openRequestCount: number;
}

export class OpenRequestsByCategoryResponseDto {
  @ApiProperty({ type: [OpenRequestsByCategoryItemDto] })
  items: OpenRequestsByCategoryItemDto[];

  @ApiProperty({ description: 'Total number of open requests included.' })
  totalOpenRequests: number;
}
