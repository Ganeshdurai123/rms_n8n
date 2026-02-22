import type { Request, Response, NextFunction } from 'express';
import * as notificationService from './notification.service.js';
import { paginatedResponse } from '../../middleware/pagination.js';

/**
 * GET /api/v1/notifications
 * List notifications for the authenticated user with pagination and optional isRead filter.
 */
export async function listNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { notifications, total, page, limit } =
      await notificationService.getNotifications(req.user!._id, req.query as any);
    res.status(200).json(paginatedResponse(notifications as any[], total, page, limit));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/notifications/unread-count
 * Get the unread notification count for the authenticated user.
 */
export async function unreadCount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const count = await notificationService.getUnreadCount(req.user!._id);
    res.status(200).json({ count });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/notifications/:notificationId/read
 * Mark a notification as read.
 */
export async function markRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const notification = await notificationService.markAsRead(
      req.params.notificationId as string,
      req.user!._id,
    );
    res.status(200).json({ data: notification });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/notifications/:notificationId/unread
 * Mark a notification as unread.
 */
export async function markUnread(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const notification = await notificationService.markAsUnread(
      req.params.notificationId as string,
      req.user!._id,
    );
    res.status(200).json({ data: notification });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all unread notifications as read for the authenticated user.
 */
export async function markAllRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const updated = await notificationService.markAllAsRead(req.user!._id);
    res.status(200).json({ updated });
  } catch (err) {
    next(err);
  }
}
