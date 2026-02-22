import { Notification } from './notification.model.js';
import type { INotificationDocument, NotificationType } from './notification.model.js';
import { getIO } from '../../config/socket.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors.js';
import logger from '../../config/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Shared input shape for creating notifications.
 * Used by both fire-and-forget `createNotification` and throwing
 * `createNotificationFromInternal`.
 */
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  programId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Internal helper — emit to specific user's sockets
// ---------------------------------------------------------------------------

function emitToUser(userId: string, notification: INotificationDocument): void {
  try {
    const io = getIO();
    const sockets = io.sockets.sockets;

    for (const [, socket] of sockets) {
      if (socket.data.userId === userId) {
        socket.emit('notification:created', {
          event: 'notification:created',
          programId: notification.programId?.toString() ?? '',
          requestId: notification.requestId?.toString() ?? '',
          data: {
            _id: notification._id.toString(),
            type: notification.type,
            title: notification.title,
            message: notification.message,
            isRead: notification.isRead,
            programId: notification.programId?.toString(),
            requestId: notification.requestId?.toString(),
            metadata: notification.metadata,
            createdAt: notification.createdAt.toISOString(),
          },
          performedBy: { userId: 'system', name: 'System' },
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    logger.warn('Failed to emit notification via Socket.IO:', err);
  }
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Create a notification and push it via Socket.IO to the target user.
 * Fire-and-forget: never throws, returns null on failure.
 */
export async function createNotification(
  data: CreateNotificationInput,
): Promise<INotificationDocument | null> {
  try {
    const notification = await Notification.create({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      programId: data.programId,
      requestId: data.requestId,
      metadata: data.metadata,
    });

    emitToUser(data.userId, notification);

    return notification;
  } catch (err) {
    logger.error('Failed to create notification:', err);
    return null;
  }
}

/**
 * Create a notification (throwing variant for internal API).
 * Same creation + Socket.IO emission, but throws on failure so the
 * internal API controller can handle errors via try/catch + next().
 */
export async function createNotificationFromInternal(
  data: CreateNotificationInput,
): Promise<INotificationDocument> {
  const notification = await Notification.create({
    userId: data.userId,
    type: data.type,
    title: data.title,
    message: data.message,
    programId: data.programId,
    requestId: data.requestId,
    metadata: data.metadata,
  });

  emitToUser(data.userId, notification);

  return notification;
}

/**
 * Get paginated notifications for a user, sorted by createdAt descending.
 * Optionally filter by isRead status.
 */
export async function getNotifications(
  userId: string,
  query: { page: number; limit: number; isRead?: boolean },
): Promise<{
  notifications: INotificationDocument[];
  total: number;
  page: number;
  limit: number;
}> {
  const filter: Record<string, unknown> = { userId };
  if (query.isRead !== undefined) {
    filter.isRead = query.isRead;
  }

  const skip = (query.page - 1) * query.limit;

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  return {
    notifications: notifications as INotificationDocument[],
    total,
    page: query.page,
    limit: query.limit,
  };
}

/**
 * Get the count of unread notifications for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ userId, isRead: false });
}

/**
 * Mark a notification as read. Verifies ownership.
 */
export async function markAsRead(
  notificationId: string,
  userId: string,
): Promise<INotificationDocument> {
  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }
  if (notification.userId.toString() !== userId) {
    throw new ForbiddenError('Cannot modify another user\'s notification');
  }

  notification.isRead = true;
  await notification.save();
  return notification;
}

/**
 * Mark a notification as unread. Verifies ownership.
 */
export async function markAsUnread(
  notificationId: string,
  userId: string,
): Promise<INotificationDocument> {
  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }
  if (notification.userId.toString() !== userId) {
    throw new ForbiddenError('Cannot modify another user\'s notification');
  }

  notification.isRead = false;
  await notification.save();
  return notification;
}

/**
 * Bulk mark all unread notifications as read for a user.
 * Returns the count of updated documents.
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true } },
  );
  return result.modifiedCount;
}
