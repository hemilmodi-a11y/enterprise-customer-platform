import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import * as Joi from 'joi';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { FastifyDemoController } from './fastify-demo.controller';
import { FastifyDemoRequestLoggingInterceptor } from './fastify-demo-request-logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        JWT_SECRET: Joi.string().required(),
        FASTIFY_PORT: Joi.number().port().default(3002),
      }).unknown(true),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [FastifyDemoController],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    FastifyDemoRequestLoggingInterceptor,
  ],
})
export class FastifyDemoModule {}
