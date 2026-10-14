import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ServiceRequest } from '../requests/service-request.entity';
import { CatalogService } from '../services/catalog-service.entity';
import { MongoDatabaseModule } from './mongodb.module';
import { ServiceRequestReadModel, ServiceRequestReadModelSchema } from './service-request-read-model.schema';
import { ServiceRequestSyncOutbox } from './service-request-sync-outbox.entity';
import { ServiceRequestSyncService } from './service-request-sync.service';

@Module({
  imports: [
    MongoDatabaseModule,
    MongooseModule.forFeature([
      {
        name: ServiceRequestReadModel.name,
        schema: ServiceRequestReadModelSchema,
      },
    ]),
    TypeOrmModule.forFeature([
      ServiceRequest,
      CatalogService,
      ServiceRequestSyncOutbox,
    ]),
  ],
  providers: [ServiceRequestSyncService],
  exports: [ServiceRequestSyncService, MongooseModule],
})
export class ServiceRequestReadModelModule {}
