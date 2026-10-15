import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    writeOnly: true,
    description: 'Refresh token returned by a successful login or refresh.',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
