import { Router } from 'express';
import * as notificationController from './notification.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import {
  listNotificationsSchema,
  markNotificationSchema,
} from './notification.schema.js';

const router = Router();

// All notification routes require authentication (JWT)
router.use(authenticate);

// GET /notifications -- list notifications (paginated, filterable by read status)
router.get(
  '/',
  validate(listNotificationsSchema, 'query'),
  notificationController.listNotifications,
);

// GET /notifications/unread-count -- get unread notification count
router.get('/unread-count', notificationController.unreadCount);

// PATCH /notifications/read-all -- mark all notifications as read
// NOTE: Must be mounted BEFORE /:notificationId/* to avoid "read-all" being parsed as a notificationId
router.patch('/read-all', notificationController.markAllRead);

// PATCH /notifications/:notificationId/read -- mark single notification as read
router.patch(
  '/:notificationId/read',
  validate(markNotificationSchema, 'params'),
  notificationController.markRead,
);

// PATCH /notifications/:notificationId/unread -- mark single notification as unread
router.patch(
  '/:notificationId/unread',
  validate(markNotificationSchema, 'params'),
  notificationController.markUnread,
);

export { router as notificationRouter };
