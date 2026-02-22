import type { Request, Response, NextFunction } from 'express';
import { getIO } from '../../config/socket.js';
import logger from '../../config/logger.js';
import type { SocketEventName, SocketEventPayload } from '../../shared/socketEvents.js';
import { createNotificationFromInternal } from '../notification/notification.service.js';
import type { NotificationType } from '../notification/notification.model.js';
import { NOTIFICATION_TYPES } from '../notification/notification.model.js';
import { Request as RequestModel } from '../request/request.model.js';

/**
 * All valid socket event names for validation.
 */
const VALID_SOCKET_EVENTS: ReadonlySet<string> = new Set<string>([
  'request:created',
  'request:updated',
  'request:status_changed',
  'request:assigned',
  'comment:added',
  'comment:deleted',
  'attachment:uploaded',
  'attachment:deleted',
]);

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Simple health check for internal API connectivity testing.
 * Used by n8n to verify the Express server is reachable.
 */
export const healthCheck = (_req: Request, res: Response): void => {
  res.json({ status: 'ok', service: 'internal-api' });
};

// ---------------------------------------------------------------------------
// Socket Emit
// ---------------------------------------------------------------------------

/**
 * Accepts a POST body and emits a typed Socket.IO event to a program room.
 *
 * Lets n8n push real-time updates to connected clients (e.g., after sending
 * an email notification, push a "notification sent" event to the room).
 *
 * Body: { event: SocketEventName, programId: string, payload: object }
 */
export const socketEmit = (req: Request, res: Response): void => {
  const { event, programId, payload } = req.body as {
    event?: string;
    programId?: string;
    payload?: Record<string, unknown>;
  };

  // Inline validation (internal API is trusted, no Zod middleware)
  if (!event || !programId || !payload) {
    res.status(400).json({
      error: 'Missing required fields: event, programId, payload',
    });
    return;
  }

  if (!VALID_SOCKET_EVENTS.has(event)) {
    res.status(400).json({
      error: `Invalid event name: ${event}`,
      validEvents: [...VALID_SOCKET_EVENTS],
    });
    return;
  }

  try {
    const io = getIO();
    io.to(`program:${programId}`).emit(event as SocketEventName, payload as unknown as SocketEventPayload);

    logger.debug(`Internal socket-emit: ${event} to program:${programId}`);
    res.json({ success: true, event, programId });
  } catch (error) {
    // Socket.IO not initialized
    logger.error('Socket-emit failed: Socket.IO not initialized', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({ error: 'Socket.IO not available' });
  }
};

// ---------------------------------------------------------------------------
// Create Notification (n8n callback)
// ---------------------------------------------------------------------------

/**
 * Creates an in-app notification on behalf of n8n.
 *
 * After n8n sends an email notification, it calls this endpoint to also
 * create a corresponding in-app (bell) notification so the user sees both.
 *
 * Body: { userId, type, title, message, programId?, requestId?, metadata? }
 */
export const createNotificationHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { userId, type, title, message, programId, requestId, metadata } =
      req.body as {
        userId?: string;
        type?: string;
        title?: string;
        message?: string;
        programId?: string;
        requestId?: string;
        metadata?: Record<string, unknown>;
      };

    // Inline validation -- internal API is trusted but enforce required fields
    if (!userId || !type || !title || !message) {
      res.status(400).json({
        error: 'Missing required fields: userId, type, title, message',
      });
      return;
    }

    // Validate notification type against the enum
    if (!NOTIFICATION_TYPES.includes(type as NotificationType)) {
      res.status(400).json({
        error: `Invalid notification type: ${type}`,
        validTypes: [...NOTIFICATION_TYPES],
      });
      return;
    }

    const notification = await createNotificationFromInternal({
      userId,
      type: type as NotificationType,
      title,
      message,
      programId,
      requestId,
      metadata,
    });

    logger.debug(`Internal notification created for user ${userId}: ${type}`);
    res.status(201).json({ success: true, notification });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Get Pending Reminders
// ---------------------------------------------------------------------------

/**
 * Returns requests that have been stale (in submitted/in_review status) for
 * more than 48 hours. n8n's scheduled-reminder workflow calls this daily to
 * determine which requests need reminder emails.
 *
 * Query: ?programId=...  (optional filter)
 */
export const getPendingReminders = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { programId } = req.query as { programId?: string };

    const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const filter: Record<string, unknown> = {
      status: { $in: ['submitted', 'in_review'] },
      updatedAt: { $lt: staleThreshold },
    };

    if (programId) {
      filter.programId = programId;
    }

    const requests = await RequestModel.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .sort({ updatedAt: 1 })
      .limit(100)
      .lean();

    const reminders = requests.map((r) => {
      const createdByUser = r.createdBy as unknown as {
        _id: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      } | null;
      const assignedToUser = r.assignedTo as unknown as {
        _id: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      } | null;

      return {
        requestId: r._id.toString(),
        title: r.title,
        programId: r.programId.toString(),
        status: r.status,
        assignedTo: assignedToUser
          ? {
              email: assignedToUser.email ?? '',
              name: `${assignedToUser.firstName ?? ''} ${assignedToUser.lastName ?? ''}`.trim(),
            }
          : null,
        createdBy: createdByUser
          ? {
              email: createdByUser.email ?? '',
              name: `${createdByUser.firstName ?? ''} ${createdByUser.lastName ?? ''}`.trim(),
            }
          : null,
        staleSince: r.updatedAt,
      };
    });

    res.json({ reminders, count: reminders.length });
  } catch (error) {
    next(error);
  }
};
