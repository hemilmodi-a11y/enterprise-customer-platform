import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class EchoDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 500)
  message: string;
}
