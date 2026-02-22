import { z } from 'zod';

/**
 * MongoDB ObjectId regex pattern for string validation.
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema for query parameters when listing notifications.
 * Supports pagination and optional isRead filter.
 */
export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isRead: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;

/**
 * Schema for notification route parameters (notificationId).
 */
export const markNotificationSchema = z.object({
  notificationId: z.string().regex(objectIdRegex, 'Invalid notification ID'),
});

export type MarkNotificationParams = z.infer<typeof markNotificationSchema>;
