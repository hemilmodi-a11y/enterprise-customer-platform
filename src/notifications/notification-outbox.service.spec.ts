import { describe, expect, it, jest } from '@jest/globals';

import { NotificationType } from './notification.schema';
import { NotificationOutboxService } from './notification-outbox.service';
import { NotificationsService } from './notifications.service';

describe('NotificationOutboxService', () => {
  const payload = {
    recipientUserId: 42,
    type: NotificationType.SERVICE_REQUEST,
    title: 'Service request assigned',
    message: 'Service request #12 has been assigned to you.',
    relatedServiceRequestId: 12,
  };

  it('delivers pending events and acknowledges them after MongoDB upsert', async () => {
    const event = {
      id: 9,
      eventKey: 'service-request:12:assigned',
      payload,
      attempts: 0,
    };
    const outboxRepository = {
      find: jest.fn().mockResolvedValue([event]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const notificationsService = {
      createWorkflowNotification: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NotificationOutboxService(
      outboxRepository as never,
      notificationsService as never,
    );

    await service.processPending();

    expect(
      notificationsService.createWorkflowNotification,
    ).toHaveBeenCalledWith('notification-outbox:9', payload);
    expect(outboxRepository.update).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        processedAt: expect.any(Date),
        lastError: null,
      }),
    );
  });

  it('records exponential retry state when notification storage fails', async () => {
    const event = { id: 10, payload, attempts: 2 };
    const outboxRepository = {
      find: jest.fn().mockResolvedValue([event]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const notificationsService = {
      createWorkflowNotification: jest
        .fn()
        .mockRejectedValue(new Error('MongoDB is unavailable')),
    };
    const service = new NotificationOutboxService(
      outboxRepository as never,
      notificationsService as never,
    );

    await service.processPending();

    expect(outboxRepository.update).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        attempts: 3,
        nextAttemptAt: expect.any(Date),
        lastError: 'Error',
      }),
    );
  });

  it('enqueues the event through the caller transaction', async () => {
    const queryBuilder = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const repository = { createQueryBuilder: jest.fn(() => queryBuilder) };
    const manager = { getRepository: jest.fn(() => repository) };
    const service = new NotificationOutboxService(
      {} as never,
      {} as unknown as NotificationsService,
    );

    await service.enqueue(
      manager as never,
      'service-request:12:assigned',
      payload,
    );

    expect(manager.getRepository).toHaveBeenCalled();
    expect(queryBuilder.values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'service-request:12:assigned',
        payload,
        nextAttemptAt: expect.any(Date),
      }),
    );
    expect(queryBuilder.execute).toHaveBeenCalled();
  });
});
