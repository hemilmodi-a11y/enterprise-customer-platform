import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey: configService.getOrThrow<string>(
        'JWT_SECRET',
      ),
    });
  }

  async validate(payload: {
    sub: number;
    email: string;
    roles?: unknown;
  }) {
    return {
      userId: payload.sub,
      email: payload.email,
      roles: Array.isArray(payload.roles)
        ? payload.roles.filter(
            (role): role is string => typeof role === 'string',
          )
        : [],
    };
  }
}