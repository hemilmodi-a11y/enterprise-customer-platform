import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({ type: Number })
  id: number;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  isActive: boolean;
}

export class RegisteredUserResponseDto extends AuthUserResponseDto {
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class AuthTokenResponseDto {
  @ApiProperty({
    description: 'Short-lived access JWT. No example token is published.',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Opaque refresh token. Treat as a credential.',
  })
  refreshToken: string;

  @ApiProperty({ enum: ['Bearer'] })
  tokenType: 'Bearer';

  @ApiProperty({ example: '15m' })
  expiresIn: string;

  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;
}

export class MessageResponseDto {
  @ApiProperty()
  message: string;
}

export class ForgotPasswordResponseDto extends MessageResponseDto {
  @ApiPropertyOptional({
    description:
      'Development-only reset token. Password reset email delivery is not configured outside development.',
  })
  resetToken?: string;
}
