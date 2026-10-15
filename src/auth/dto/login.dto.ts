import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ format: 'email', maxLength: 254 })
  @IsEmail()
  email: string;

  @ApiProperty({ format: 'password', minLength: 8, maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @Length(8, 100)
  password: string;
}
