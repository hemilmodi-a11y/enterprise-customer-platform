import { describe, expect, it } from '@jest/globals';
import { model } from 'mongoose';

import { Notification, NotificationSchema, NotificationType } from './notification.schema';

describe('Notification MongoDB schema', () => {
  const ValidationModel = model('NotificationSchemaValidation', NotificationSchema);

  it('requires a recipient, valid type, title, and message and applies read defaults', () => {
    const valid = new ValidationModel({
      recipientUserId: 42,
      type: NotificationType.SYSTEM,
      title: 'System update',
      message: 'A maintenance window is scheduled.',
    });
    expect(valid.validateSync()).toBeUndefined();
    expect(valid.isRead).toBe(false);

    const invalid = new ValidationModel({
      recipientUserId: -4,
      type: 'invalid',
      title: '',
    });
    const validationError = invalid.validateSync();
    expect(validationError?.errors.recipientUserId).toBeDefined();
    expect(validationError?.errors.type).toBeDefined();
    expect(validationError?.errors.message).toBeDefined();
  });

  it('defines indexes for recipient chronological and unread queries', () => {
    const indexes = NotificationSchema.indexes().map(([fields]) => fields);
    expect(indexes).toContainEqual({
      recipientUserId: 1,
      createdAt: -1,
      _id: -1,
    });
    expect(indexes).toContainEqual({
      recipientUserId: 1,
      isRead: 1,
      createdAt: -1,
    });
  });
});
