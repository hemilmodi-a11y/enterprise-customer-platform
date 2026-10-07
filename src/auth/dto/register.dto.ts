import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 100)
  password: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  lastName: string;
}