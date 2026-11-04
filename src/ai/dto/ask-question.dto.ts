import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AskQuestionDto {
  @ApiProperty({
    example: 'How can I troubleshoot my internet connection?',
    minLength: 3,
    maxLength: 1000,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  question: string;
}
