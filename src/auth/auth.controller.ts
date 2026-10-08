import { Body, Controller, Post } from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
refresh(@Body() refreshTokenDto: RefreshTokenDto) {
  return this.authService.refresh(
    refreshTokenDto.refreshToken,
  );
}

@Post('logout')
logout(@Body() refreshTokenDto: RefreshTokenDto) {
  return this.authService.logout(
    refreshTokenDto.refreshToken,
  );
}
@Post('forgot-password')
forgotPassword(
  @Body() forgotPasswordDto: ForgotPasswordDto,
) {
  return this.authService.forgotPassword(
    forgotPasswordDto,
  );
}

@Post('reset-password')
resetPassword(
  @Body() resetPasswordDto: ResetPasswordDto,
) {
  return this.authService.resetPassword(
    resetPasswordDto,
  );
}
}