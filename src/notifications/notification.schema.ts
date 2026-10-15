import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum NotificationType {
  SERVICE_REQUEST = 'service_request',
  ACCOUNT = 'account',
  SYSTEM = 'system',
}

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({
  collection: 'notifications',
  timestamps: true,
  versionKey: false,
})
export class Notification {
  @Prop({ type: Number, required: true, min: 1 })
  recipientUserId: number;

  @Prop({ type: String, required: true, enum: Object.values(NotificationType) })
  type: NotificationType;

  @Prop({ type: String, required: true, trim: true, maxlength: 150 })
  title: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 2000 })
  message: string;

  @Prop({ type: Number, min: 1, default: null })
  relatedServiceRequestId: number | null;

  @Prop({ type: String, default: undefined })
  eventKey?: string;

  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  @Prop({ type: Date, default: null })
  readAt: Date | null;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index(
  { recipientUserId: 1, createdAt: -1, _id: -1 },
  { name: 'IDX_notifications_recipient_created' },
);
NotificationSchema.index(
  { recipientUserId: 1, isRead: 1, createdAt: -1 },
  { name: 'IDX_notifications_recipient_read_created' },
);
NotificationSchema.index(
  { eventKey: 1 },
  { name: 'UQ_notifications_event_key', unique: true, sparse: true },
);
