import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export function createDatabaseConfig(
  configService: ConfigService,
): TypeOrmModuleOptions {
  return {
    type: 'mysql',

    host: configService.getOrThrow<string>('DB_HOST'),
    port: configService.getOrThrow<number>('DB_PORT'),

    username: configService.getOrThrow<string>('DB_USERNAME'),
    password: configService.getOrThrow<string>('DB_PASSWORD'),
    database: configService.getOrThrow<string>('DB_NAME'),

    autoLoadEntities: true,

    // Never let TypeORM automatically modify the database schema.
    synchronize: false,

    logging:
      configService.get<string>('NODE_ENV') === 'development'
        ? ['error', 'warn']
        : ['error'],
  };
}