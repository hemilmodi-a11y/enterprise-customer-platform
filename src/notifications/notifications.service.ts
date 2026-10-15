import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRepository } from '@nestjs/typeorm';
import { FilterQuery, Model } from 'mongoose';
import { Repository } from 'typeorm';

import { User } from '../users/user.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { Notification } from './notification.schema';
import { NotificationOutboxPayload } from './notification-outbox.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationsModel: Model<Notification>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    const recipient = await this.usersRepository.findOne({
      where: { id: dto.recipientUserId },
      select: { id: true },
    });
    if (!recipient) {
      throw new NotFoundException(
        `Recipient user with id ${dto.recipientUserId} not found`,
      );
    }

    this.ensureConnected();
    try {
      const notification = await this.notificationsModel.create({
        recipientUserId: dto.recipientUserId,
        type: dto.type,
        title: dto.title.trim(),
        message: dto.message.trim(),
        relatedServiceRequestId: dto.relatedServiceRequestId ?? null,
      });
      return this.toResponse(notification);
    } catch (error) {
      this.logDatabaseError(error);
      throw new ServiceUnavailableException(
        'Notification storage is temporarily unavailable.',
      );
    }
  }

  async listForUser(userId: number, query: ListNotificationsQueryDto) {
    this.ensureConnected();
    const filter: FilterQuery<Notification> = { recipientUserId: userId };
    if (query.isRead !== undefined) {
      filter.isRead = query.isRead;
    } else if (query.unreadOnly) {
      filter.isRead = false;
    }

    try {
      const [documents, total] = await Promise.all([
        this.notificationsModel
          .find(filter)
          .sort({ createdAt: query.sortOrder === 'ASC' ? 1 : -1, _id: -1 })
          .skip((query.page - 1) * query.limit)
          .limit(query.limit)
          .lean()
          .exec(),
        this.notificationsModel.countDocuments(filter).exec(),
      ]);

      return {
        items: documents.map((document) => this.toResponse(document)),
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      };
    } catch (error) {
      this.logDatabaseError(error);
      throw new ServiceUnavailableException(
        'Notification storage is temporarily unavailable.',
      );
    }
  }

  async unreadCountForUser(userId: number): Promise<number> {
    this.ensureConnected();
    try {
      return await this.notificationsModel
        .countDocuments({ recipientUserId: userId, isRead: false })
        .exec();
    } catch (error) {
      this.logDatabaseError(error);
      throw new ServiceUnavailableException(
        'Notification storage is temporarily unavailable.',
      );
    }
  }

  async markAllReadForUser(userId: number): Promise<number> {
    this.ensureConnected();
    try {
      const result = await this.notificationsModel
        .updateMany(
          { recipientUserId: userId, isRead: false },
          { $set: { isRead: true, readAt: new Date() } },
        )
        .exec();
      return result.modifiedCount;
    } catch (error) {
      this.logDatabaseError(error);
      throw new ServiceUnavailableException(
        'Notification storage is temporarily unavailable.',
      );
    }
  }

  async createWorkflowNotification(
    eventKey: string,
    payload: NotificationOutboxPayload,
  ): Promise<void> {
    this.ensureConnected();
    try {
      await this.notificationsModel
        .updateOne(
          { eventKey },
          {
            $setOnInsert: {
              ...payload,
              eventKey,
            },
          },
          { upsert: true, runValidators: true },
        )
        .exec();
    } catch (error) {
      this.logDatabaseError(error);
      throw new ServiceUnavailableException(
        'Notification storage is temporarily unavailable.',
      );
    }
  }

  async markRead(
    notificationId: string,
    userId: number,
  ): Promise<NotificationResponseDto> {
    if (!/^[a-f\d]{24}$/i.test(notificationId)) {
      throw new NotFoundException('Notification not found');
    }

    this.ensureConnected();
    try {
      const notification = await this.notificationsModel
        .findOneAndUpdate(
          { _id: notificationId, recipientUserId: userId },
          { $set: { isRead: true, readAt: new Date() } },
          { new: true, runValidators: true },
        )
        .lean()
        .exec();

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      return this.toResponse(notification);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logDatabaseError(error);
      throw new ServiceUnavailableException(
        'Notification storage is temporarily unavailable.',
      );
    }
  }

  private ensureConnected(): void {
    if (this.notificationsModel.db.readyState !== 1) {
      throw new ServiceUnavailableException(
        'Notification storage is temporarily unavailable.',
      );
    }
  }

  private toResponse(notification: {
    _id: unknown;
    recipientUserId: number;
    type: Notification['type'];
    title: string;
    message: string;
    relatedServiceRequestId?: number | null;
    isRead: boolean;
    readAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): NotificationResponseDto {
    return {
      id: String(notification._id),
      recipientUserId: notification.recipientUserId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      relatedServiceRequestId: notification.relatedServiceRequestId ?? null,
      isRead: notification.isRead,
      readAt: notification.readAt ?? null,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }

  private logDatabaseError(error: unknown): void {
    this.logger.error(
      `Notification database operation failed (${error instanceof Error ? error.name : 'UnknownError'}).`,
    );
  }
}
