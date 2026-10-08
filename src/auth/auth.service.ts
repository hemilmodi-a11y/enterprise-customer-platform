import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  IsNull,
  MoreThan,
  Repository,
} from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

import { RefreshToken } from './refresh-token.entity';
import { PasswordResetToken } from './password-reset-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,

    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
  ) {}

  // --------------------------------------------------
  // REGISTER
  // --------------------------------------------------

  async register(registerDto: RegisterDto) {
    const passwordHash = await bcrypt.hash(
      registerDto.password,
      12,
    );

    const user = await this.usersService.create({
      email: registerDto.email,
      passwordHash,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
    });

    // Every newly registered user gets Customer role
    await this.usersService.assignCustomerRole(user);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  // --------------------------------------------------
  // LOGIN
  // --------------------------------------------------

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(
      loginDto.email,
    );

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'User account is inactive',
      );
    }

    const roles = await this.usersService.findRolesByUserId(
      user.id,
    );

    const payload = {
      sub: user.id,
      email: user.email,
      roles,
    };

    const accessToken =
      await this.jwtService.signAsync(payload);

    const refreshToken =
      await this.createRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: '15m',

      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
      },
    };
  }

  // --------------------------------------------------
  // REFRESH TOKEN
  // --------------------------------------------------

  async refresh(refreshToken: string) {
    const tokenHash =
      this.hashRefreshToken(refreshToken);

    const storedToken =
      await this.refreshTokenRepository.findOne({
        where: {
          tokenHash,
        },
        relations: {
          user: true,
        },
      });

    if (!storedToken) {
      throw new UnauthorizedException(
        'Invalid refresh token',
      );
    }

    if (storedToken.revokedAt) {
      throw new UnauthorizedException(
        'Refresh token has been revoked',
      );
    }

    if (storedToken.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Refresh token has expired',
      );
    }

    const user = storedToken.user;

    if (!user.isActive) {
      throw new UnauthorizedException(
        'User account is inactive',
      );
    }

    const roles =
      await this.usersService.findRolesByUserId(
        user.id,
      );

    const payload = {
      sub: user.id,
      email: user.email,
      roles,
    };

    const accessToken =
      await this.jwtService.signAsync(payload);

    // Rotate refresh token
    storedToken.revokedAt = new Date();

    await this.refreshTokenRepository.save(
      storedToken,
    );

    const newRefreshToken =
      await this.createRefreshToken(user);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn: '15m',

      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
      },
    };
  }

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  async logout(refreshToken: string) {
    const tokenHash =
      this.hashRefreshToken(refreshToken);

    const storedToken =
      await this.refreshTokenRepository.findOne({
        where: {
          tokenHash,
        },
      });

    if (storedToken && !storedToken.revokedAt) {
      storedToken.revokedAt = new Date();

      await this.refreshTokenRepository.save(
        storedToken,
      );
    }

    return {
      message: 'Logged out successfully',
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    if (
      this.configService.get<string>('NODE_ENV') !==
      'development'
    ) {
      throw new ServiceUnavailableException(
        'Password reset email delivery is not configured',
      );
    }

    const user = await this.usersService.findByEmail(
      forgotPasswordDto.email,
    );

    if (!user) {
      return {
        message:
          'If an account exists, a password reset token has been created.',
      };
    }

    const resetToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256')
      .update(resetToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const passwordResetToken =
      this.passwordResetTokenRepository.create({
        user,
        tokenHash,
        expiresAt,
        usedAt: null,
      });

    await this.passwordResetTokenRepository.save(
      passwordResetToken,
    );

    return {
      message:
        'If an account exists, a password reset token has been created.',
      resetToken,
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const tokenHash = createHash('sha256')
      .update(resetPasswordDto.token)
      .digest('hex');
    const now = new Date();
    const passwordHash = await bcrypt.hash(
      resetPasswordDto.newPassword,
      12,
    );

    await this.passwordResetTokenRepository.manager.transaction(
      async (manager) => {
        const resetTokenRepository =
          manager.getRepository(PasswordResetToken);
        const result = await resetTokenRepository.update(
          {
            tokenHash,
            usedAt: IsNull(),
            expiresAt: MoreThan(now),
          },
          { usedAt: now },
        );

        if (result.affected !== 1) {
          throw new UnauthorizedException(
            'Invalid or expired password reset token',
          );
        }

        const resetToken =
          await resetTokenRepository.findOne({
            where: { tokenHash },
            relations: { user: true },
          });

        if (!resetToken) {
          throw new UnauthorizedException(
            'Invalid or expired password reset token',
          );
        }

        resetToken.user.passwordHash = passwordHash;
        await manager.getRepository(User).save(resetToken.user);
      },
    );

    return {
      message: 'Password has been reset successfully',
    };
  }

  // --------------------------------------------------
  // CREATE REFRESH TOKEN
  // --------------------------------------------------

  private async createRefreshToken(
    user: User,
  ): Promise<string> {
    // Generate cryptographically secure random token
    const refreshToken =
      randomBytes(64).toString('hex');

    // Never store raw token in database
    const tokenHash =
      this.hashRefreshToken(refreshToken);

    // Refresh token valid for 7 days
    const expiresAt = new Date();

    expiresAt.setDate(
      expiresAt.getDate() + 7,
    );

    const refreshTokenEntity =
      this.refreshTokenRepository.create({
        user,
        tokenHash,
        expiresAt,
        revokedAt: null,
      });

    await this.refreshTokenRepository.save(
      refreshTokenEntity,
    );

    return refreshToken;
  }

  // --------------------------------------------------
  // HASH REFRESH TOKEN
  // --------------------------------------------------

  private hashRefreshToken(
    token: string,
  ): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }
}