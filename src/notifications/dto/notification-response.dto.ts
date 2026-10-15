import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../notification.schema';

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  recipientUserId: number;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  relatedServiceRequestId: number | null;

  @ApiProperty()
  isRead: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  readAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedNotificationsResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items: NotificationResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class UnreadNotificationCountResponseDto {
  @ApiProperty()
  unreadCount: number;
}

export class MarkAllNotificationsReadResponseDto {
  @ApiProperty()
  updatedCount: number;
}
