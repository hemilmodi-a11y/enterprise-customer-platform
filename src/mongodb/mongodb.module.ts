import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

const logger = new Logger('MongoDB');

export function createMongoConnectionOptions(config: ConfigService) {
  return {
    uri: config.getOrThrow<string>('MONGO_URI'),
    lazyConnection: true,
    serverSelectionTimeoutMS: 5000,
    connectionFactory: (connection: {
      on: (event: string, listener: () => void) => void;
    }) => {
      connection.on('error', () => {
        logger.error('MongoDB connection error; document features are unavailable.');
      });
      connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected; document features are unavailable.');
      });
      connection.on('connected', () => {
        logger.log('MongoDB connected.');
      });
      return connection;
    },
  };
}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createMongoConnectionOptions,
    }),
  ],
  exports: [MongooseModule],
})
export class MongoDatabaseModule {}
