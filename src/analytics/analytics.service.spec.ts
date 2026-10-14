import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';

import {
  OPEN_SERVICE_REQUEST_STATUSES,
  ServiceRequestStatus,
} from '../requests/service-request-status.enum';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const createService = (
    aggregate: jest.Mock,
    readyState = 1,
    syncService = { assertReportingReadModelCurrent: jest.fn() },
  ) =>
    new AnalyticsService(
      {
        db: { readyState },
        aggregate,
      } as never,
      syncService as never,
    );

  it('groups open requests with the workflow status allowlist', async () => {
    const exec = jest.fn().mockResolvedValue([
      { category: 'Support', openRequestCount: 2 },
      { category: 'Network', openRequestCount: 1 },
    ]);
    const aggregate = jest.fn(() => ({ exec }));
    const service = createService(aggregate);

    await expect(service.openRequestsByCategory({})).resolves.toEqual({
      items: [
        { category: 'Support', openRequestCount: 2 },
        { category: 'Network', openRequestCount: 1 },
      ],
      totalOpenRequests: 3,
    });

    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({
      $match: { status: { $in: OPEN_SERVICE_REQUEST_STATUSES } },
    });
    expect(OPEN_SERVICE_REQUEST_STATUSES).not.toContain(
      ServiceRequestStatus.RESOLVED,
    );
    expect(OPEN_SERVICE_REQUEST_STATUSES).not.toContain(
      ServiceRequestStatus.CLOSED,
    );
    expect(pipeline[1]).toEqual({
      $group: {
        _id: '$serviceCategory',
        openRequestCount: { $sum: 1 },
      },
    });
  });

  it('supports a parameterized exact category filter and empty results', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const aggregate = jest.fn(() => ({ exec }));
    const service = createService(aggregate);

    await expect(
      service.openRequestsByCategory({ category: 'Support' }),
    ).resolves.toEqual({ items: [], totalOpenRequests: 0 });
    expect(aggregate.mock.calls[0][0][0]).toEqual({
      $match: {
        status: { $in: OPEN_SERVICE_REQUEST_STATUSES },
        serviceCategory: 'Support',
      },
    });
  });

  it('returns service unavailable when MongoDB is disconnected or aggregation fails', async () => {
    const disconnected = createService(jest.fn(), 0);
    await expect(disconnected.openRequestsByCategory({})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    const failed = createService(
      jest.fn(() => ({ exec: jest.fn().mockRejectedValue(new Error('db error')) })),
    );
    await expect(failed.openRequestsByCategory({})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('does not report zero while the MySQL outbox still contains unsynchronized changes', async () => {
    const aggregate = jest.fn();
    const service = createService(aggregate, 1, {
      assertReportingReadModelCurrent: jest
        .fn()
        .mockRejectedValue(new ServiceUnavailableException()),
    });

    await expect(service.openRequestsByCategory({})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(aggregate).not.toHaveBeenCalled();
  });
});
