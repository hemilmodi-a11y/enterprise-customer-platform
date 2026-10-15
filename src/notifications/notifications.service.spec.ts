import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { User } from '../users/user.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationType } from './notification.schema';
import { NotificationsService } from './notifications.service';

const doc = {
  _id: '64a000000000000000000001',
  recipientUserId: 17,
  type: NotificationType.SERVICE_REQUEST,
  title: 'Request assigned',
  message: 'A service request was assigned to you.',
  relatedServiceRequestId: 12,
  isRead: false,
  readAt: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
};

describe('NotificationsService', () => {
  const createService = () => {
    const notificationsModel = {
      db: { readyState: 1 },
      create: jest.fn().mockResolvedValue(doc),
      find: jest.fn(),
      countDocuments: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 3 }),
      })),
      updateOne: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue({ upsertedCount: 1 }),
      })),
    };
    const usersRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 17 } as User),
    };
    return {
      service: new NotificationsService(
        notificationsModel as never,
        usersRepository as never,
      ),
      notificationsModel,
      usersRepository,
    };
  };

  it('creates a notification after confirming the recipient exists', async () => {
    const { service, notificationsModel } = createService();
    const response = await service.create({
      recipientUserId: 17,
      type: NotificationType.SERVICE_REQUEST,
      title: 'Request assigned',
      message: 'A service request was assigned to you.',
      relatedServiceRequestId: 12,
    });

    expect(notificationsModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 17,
        type: NotificationType.SERVICE_REQUEST,
      }),
    );
    expect(response).toMatchObject({
      id: doc._id,
      recipientUserId: 17,
      isRead: false,
    });
  });

  it('lists only the current user’s notifications with database pagination and filters', async () => {
    const { service, notificationsModel } = createService();
    const exec = jest.fn().mockResolvedValue([doc]);
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec,
    };
    notificationsModel.find.mockReturnValue(query);
    notificationsModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });

    const response = await service.listForUser(17, {
      page: 2,
      limit: 10,
      unreadOnly: true,
      sortOrder: 'ASC',
    });

    expect(notificationsModel.find).toHaveBeenCalledWith({
      recipientUserId: 17,
      isRead: false,
    });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: 1, _id: -1 });
    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(response).toMatchObject({
      items: [{ id: doc._id }],
      total: 1,
      page: 2,
      limit: 10,
    });
  });

  it('uses the explicit read-state filter when both supported filters are present', async () => {
    const { service, notificationsModel } = createService();
    notificationsModel.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });
    notificationsModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });

    await service.listForUser(17, {
      page: 1,
      limit: 20,
      unreadOnly: true,
      isRead: true,
      sortOrder: 'DESC',
    });

    expect(notificationsModel.find).toHaveBeenCalledWith({
      recipientUserId: 17,
      isRead: true,
    });
  });

  it('does not expose another user’s notification when marking it read', async () => {
    const { service, notificationsModel } = createService();
    notificationsModel.findOneAndUpdate.mockReturnValue({
      new: true,
      runValidators: true,
      lean: () => ({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(service.markRead(doc._id, 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(notificationsModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: doc._id, recipientUserId: 99 },
      expect.objectContaining({
        $set: expect.objectContaining({ isRead: true }),
      }),
      { new: true, runValidators: true },
    );
  });

  it('rejects malformed notification IDs without querying MongoDB', async () => {
    const { service, notificationsModel } = createService();

    await expect(
      service.markRead('not-an-object-id', 17),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(notificationsModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('counts unread notifications and marks all only for the current recipient', async () => {
    const { service, notificationsModel } = createService();
    notificationsModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(4),
    });

    await expect(service.unreadCountForUser(17)).resolves.toBe(4);
    expect(notificationsModel.countDocuments).toHaveBeenCalledWith({
      recipientUserId: 17,
      isRead: false,
    });

    await expect(service.markAllReadForUser(17)).resolves.toBe(3);
    expect(notificationsModel.updateMany).toHaveBeenCalledWith(
      { recipientUserId: 17, isRead: false },
      {
        $set: expect.objectContaining({
          isRead: true,
          readAt: expect.any(Date),
        }),
      },
    );
  });

  it('uses an idempotent upsert for workflow notification retries', async () => {
    const { service, notificationsModel } = createService();
    const payload = {
      recipientUserId: 17,
      type: NotificationType.SERVICE_REQUEST,
      title: 'Request assigned',
      message: 'A service request was assigned to you.',
      relatedServiceRequestId: 12,
    };

    await service.createWorkflowNotification('notification-outbox:12', payload);

    expect(notificationsModel.updateOne).toHaveBeenCalledWith(
      { eventKey: 'notification-outbox:12' },
      { $setOnInsert: { ...payload, eventKey: 'notification-outbox:12' } },
      { upsert: true, runValidators: true },
    );
  });

  it('returns not found for unknown recipients and sanitizes MongoDB operation failures', async () => {
    const { service, notificationsModel, usersRepository } = createService();
    usersRepository.findOne.mockResolvedValue(null);
    await expect(
      service.create({
        recipientUserId: 900,
        type: NotificationType.SYSTEM,
        title: 'System update',
        message: 'A maintenance window is scheduled.',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    usersRepository.findOne.mockResolvedValue({ id: 17 } as User);
    notificationsModel.create.mockRejectedValue(new Error('database details'));
    await expect(
      service.create({
        recipientUserId: 17,
        type: NotificationType.SYSTEM,
        title: 'System update',
        message: 'A maintenance window is scheduled.',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('reports unavailable MongoDB and rejects invalid notification data', async () => {
    const { service, notificationsModel } = createService();
    notificationsModel.db.readyState = 0;
    await expect(
      service.listForUser(17, {
        page: 1,
        limit: 20,
        unreadOnly: false,
        sortOrder: 'DESC',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    const invalid = plainToInstance(CreateNotificationDto, {
      recipientUserId: 0,
      type: 'password',
      title: '',
      message: 'x'.repeat(2001),
      accessToken: 'must-not-be-accepted',
    });
    expect(
      await validate(invalid, {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    ).not.toHaveLength(0);
    const html = plainToInstance(CreateNotificationDto, {
      recipientUserId: 17,
      type: NotificationType.SYSTEM,
      title: '<script>alert(1)</script>',
      message: 'Maintenance update',
    });
    expect(await validate(html)).not.toHaveLength(0);

    const invalidQuery = plainToInstance(ListNotificationsQueryDto, {
      page: '0',
      limit: '200',
      unreadOnly: 'maybe',
      sortOrder: 'random',
    });
    expect(await validate(invalidQuery)).not.toHaveLength(0);
  });
});
