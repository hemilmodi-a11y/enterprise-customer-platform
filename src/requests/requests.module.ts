import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ServiceRequestReadModelModule } from '../mongodb/service-request-read-model.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { ServiceRequest } from './service-request.entity';
import { ServiceRequestAttachment } from './request-attachment.entity';
import { RequestAttachmentsService } from './request-attachments.service';
import { RequestAttachmentStorageService } from './request-attachment-storage.service';
import { AgentRequestsController } from './agent-requests.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    ServiceRequestReadModelModule,
    TypeOrmModule.forFeature([ServiceRequest, ServiceRequestAttachment]),
  ],
  controllers: [RequestsController, AgentRequestsController],
  providers: [
    RequestsService,
    RequestAttachmentsService,
    RequestAttachmentStorageService,
  ],
  exports: [RequestsService],
})
export class RequestsModule {}
