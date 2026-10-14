import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ServiceRequestReadModelModule } from '../mongodb/service-request-read-model.module';
import { CatalogService } from './catalog-service.entity';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [
    AuthModule,
    ServiceRequestReadModelModule,
    TypeOrmModule.forFeature([CatalogService]),
  ],
  controllers: [ServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
