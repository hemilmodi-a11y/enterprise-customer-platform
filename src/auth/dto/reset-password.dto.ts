import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    writeOnly: true,
    description: 'Single-use password-reset token.',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ format: 'password', minLength: 8, maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @Length(8, 100)
  newPassword: string;
}
