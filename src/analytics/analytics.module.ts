import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ServiceRequestReadModelModule } from '../mongodb/service-request-read-model.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [AuthModule, ServiceRequestReadModelModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
