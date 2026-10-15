import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { MongoDatabaseModule } from '../mongodb/mongodb.module';
import { User } from '../users/user.entity';
import { NotificationOutbox } from './notification-outbox.entity';
import { NotificationOutboxService } from './notification-outbox.service';
import { Notification, NotificationSchema } from './notification.schema';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    AuthModule,
    MongoDatabaseModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    TypeOrmModule.forFeature([User, NotificationOutbox]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationOutboxService],
  exports: [NotificationOutboxService],
})
export class NotificationsModule {}
