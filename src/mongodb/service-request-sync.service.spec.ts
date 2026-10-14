import { describe, expect, it, jest } from '@jest/globals';

import { ServiceRequestStatus } from '../requests/service-request-status.enum';
import { ServiceRequestSyncAggregateType } from './service-request-sync-outbox.entity';
import { ServiceRequestSyncService } from './service-request-sync.service';

describe('ServiceRequestSyncService', () => {
  it('writes reporting updates through an idempotent MongoDB upsert and acknowledges the outbox row', async () => {
    const outboxEvent = {
      id: 3,
      aggregateType: ServiceRequestSyncAggregateType.REQUEST,
      aggregateId: 12,
      attempts: 0,
    };
    const outboxRepository = {
      find: jest.fn().mockResolvedValue([outboxEvent]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const requestRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 12,
        status: ServiceRequestStatus.ASSIGNED,
        createdAt: new Date('2026-10-01T00:00:00Z'),
        updatedAt: new Date('2026-10-02T00:00:00Z'),
        service: { category: 'Support' },
      }),
    };
    const exec = jest.fn().mockResolvedValue({ acknowledged: true });
    const readModel = {
      db: { readyState: 1 },
      updateOne: jest.fn(() => ({ exec })),
    };
    const service = new ServiceRequestSyncService(
      {
        getRepository: jest.fn(() => requestRepository),
      } as never,
      outboxRepository as never,
      readModel as never,
    );

    await service.synchronizePending();

    expect(readModel.updateOne).toHaveBeenCalledWith(
      { sourceRequestId: 12 },
      {
        $set: {
          sourceRequestId: 12,
          serviceCategory: 'Support',
          status: ServiceRequestStatus.ASSIGNED,
          requestCreatedAt: new Date('2026-10-01T00:00:00Z'),
          requestUpdatedAt: new Date('2026-10-02T00:00:00Z'),
        },
      },
      { upsert: true, runValidators: true },
    );
    expect(outboxRepository.update).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ processedAt: expect.any(Date), lastError: null }),
    );
  });

  it('records a retry rather than acknowledging failed MongoDB writes', async () => {
    const event = {
      id: 4,
      aggregateType: ServiceRequestSyncAggregateType.REQUEST,
      aggregateId: 44,
      attempts: 0,
    };
    const outboxRepository = {
      find: jest.fn().mockResolvedValue([event]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const readModel = {
      db: { readyState: 1 },
      updateOne: jest.fn(() => ({
        exec: jest.fn().mockRejectedValue(new Error('Mongo unavailable')),
      })),
    };
    const service = new ServiceRequestSyncService(
      {
        getRepository: jest.fn(() => ({
          findOne: jest.fn().mockResolvedValue({
            id: 44,
            status: ServiceRequestStatus.SUBMITTED,
            createdAt: new Date(),
            updatedAt: new Date(),
            service: { category: 'Support' },
          }),
        })),
      } as never,
      outboxRepository as never,
      readModel as never,
    );

    await service.synchronizePending();

    expect(outboxRepository.update).toHaveBeenCalledWith(
      4,
      expect.objectContaining({
        attempts: 1,
        nextAttemptAt: expect.any(Date),
        lastError: 'Error',
      }),
    );
  });
});
