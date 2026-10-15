import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
