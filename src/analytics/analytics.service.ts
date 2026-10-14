import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ServiceRequestSyncService } from '../mongodb/service-request-sync.service';
import {
  OPEN_SERVICE_REQUEST_STATUSES,
} from '../requests/service-request-status.enum';
import { ServiceRequestReadModel } from '../mongodb/service-request-read-model.schema';
import { OpenRequestsQueryDto } from './dto/open-requests-query.dto';
import { OpenRequestsByCategoryResponseDto } from './dto/open-requests-response.dto';

interface AggregatedCategory {
  category: string;
  openRequestCount: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(ServiceRequestReadModel.name)
    private readonly readModel: Model<ServiceRequestReadModel>,
    private readonly syncService: ServiceRequestSyncService,
  ) {}

  async openRequestsByCategory(
    query: OpenRequestsQueryDto,
  ): Promise<OpenRequestsByCategoryResponseDto> {
    if (this.readModel.db.readyState !== 1) {
      throw new ServiceUnavailableException(
        'Analytics storage is temporarily unavailable.',
      );
    }
    await this.syncService.assertReportingReadModelCurrent();

    const match: Record<string, unknown> = {
      status: { $in: OPEN_SERVICE_REQUEST_STATUSES },
    };
    if (query.category) {
      match.serviceCategory = query.category;
    }

    try {
      const pipeline = [
        { $match: match },
        {
          $group: {
            _id: '$serviceCategory',
            openRequestCount: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            openRequestCount: 1,
          },
        },
        { $sort: { category: 1 as const } },
      ];
      const items = await this.readModel
        .aggregate<AggregatedCategory>(pipeline)
        .exec();

      return {
        items,
        totalOpenRequests: items.reduce(
          (total, item) => total + item.openRequestCount,
          0,
        ),
      };
    } catch (error) {
      this.logger.error(
        `Open request aggregation failed (${error instanceof Error ? error.name : 'UnknownError'}).`,
      );
      throw new ServiceUnavailableException(
        'Analytics storage is temporarily unavailable.',
      );
    }
  }
}
