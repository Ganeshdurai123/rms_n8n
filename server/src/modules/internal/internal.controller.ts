import type { Request, Response, NextFunction } from 'express';
import { getIO } from '../../config/socket.js';
import logger from '../../config/logger.js';
import type { SocketEventName, SocketEventPayload } from '../../shared/socketEvents.js';
import { createNotificationFromInternal } from '../notification/notification.service.js';
import type { NotificationType } from '../notification/notification.model.js';
import { NOTIFICATION_TYPES } from '../notification/notification.model.js';
import { Request as RequestModel } from '../request/request.model.js';
import { ReportJob } from '../report/report.model.js';
import {
  generateSummaryReport,
  generateProgramReport,
  generateOverdueReport,
  completeReport,
  failReport,
} from '../report/report.service.js';

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
 * Returns requests based on actual dueDate for reminder lookups.
 * n8n's scheduled-reminder workflow calls this daily to determine which
 * requests need reminder emails.
 *
 * Query params:
 *   ?type=upcoming|overdue  (default: both)
 *   ?programId=...          (optional filter)
 *
 * - Overdue: requests past their due date that are still pending action
 * - Upcoming: requests due within the next 24 hours
 */
export const getPendingReminders = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { programId, type: rawType } = req.query as {
      programId?: string;
      type?: string | string[];
    };

    // Normalise type -- n8n may send duplicate query params causing an array
    const type: 'upcoming' | 'overdue' | undefined =
      Array.isArray(rawType)
        ? (rawType[0] as 'upcoming' | 'overdue' | undefined)
        : (rawType as 'upcoming' | 'overdue' | undefined);

    const now = new Date();
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Base filter: only requests that have a dueDate set
    const baseFilter: Record<string, unknown> = {
      dueDate: { $exists: true, $ne: null },
    };

    if (programId) {
      baseFilter.programId = programId;
    }

    // Build type-specific query conditions
    const overdueCondition = {
      dueDate: { $lt: now },
      status: { $in: ['submitted', 'in_review'] },
    };

    const upcomingCondition = {
      dueDate: { $gte: now, $lte: in24h },
      status: { $in: ['submitted', 'in_review', 'draft'] },
    };

    let typeFilter: Record<string, unknown>;

    if (type === 'overdue') {
      typeFilter = { ...baseFilter, ...overdueCondition };
    } else if (type === 'upcoming') {
      typeFilter = { ...baseFilter, ...upcomingCondition };
    } else {
      // Both: combine overdue and upcoming with $or
      typeFilter = {
        ...baseFilter,
        $or: [overdueCondition, upcomingCondition],
      };
    }

    const requests = await RequestModel.find(typeFilter)
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .sort({ dueDate: 1 })
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

      const dueDateMs = r.dueDate?.getTime() ?? Date.now();
      const daysOverdue = Math.floor(
        (Date.now() - dueDateMs) / (24 * 60 * 60 * 1000),
      );

      return {
        requestId: r._id.toString(),
        title: r.title,
        programId: r.programId.toString(),
        status: r.status,
        dueDate: r.dueDate?.toISOString(),
        daysOverdue,
        assignedTo: assignedToUser
          ? {
              userId: assignedToUser._id.toString(),
              email: assignedToUser.email ?? '',
              name: `${assignedToUser.firstName ?? ''} ${assignedToUser.lastName ?? ''}`.trim(),
            }
          : null,
        createdBy: createdByUser
          ? {
              userId: createdByUser._id.toString(),
              email: createdByUser.email ?? '',
              name: `${createdByUser.firstName ?? ''} ${createdByUser.lastName ?? ''}`.trim(),
            }
          : null,
      };
    });

    res.json({ reminders, count: reminders.length });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Get Report Data (n8n calls this to run aggregation)
// ---------------------------------------------------------------------------

/**
 * Runs the appropriate aggregation query for a report job.
 * n8n calls this after receiving the webhook trigger.
 *
 * Query params: ?reportId=... (required)
 */
export const getReportData = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { reportId } = req.query as { reportId?: string };

    // Inline validation (internal API is trusted, no Zod middleware)
    if (!reportId) {
      res.status(400).json({ error: 'Missing required query parameter: reportId' });
      return;
    }

    // Look up the report job
    const reportJob = await ReportJob.findById(reportId);
    if (!reportJob) {
      res.status(404).json({ error: 'Report job not found' });
      return;
    }

    // Update status to processing
    reportJob.status = 'processing';
    await reportJob.save();

    const { type, params, programId } = reportJob;

    let result: Record<string, unknown>;

    switch (type) {
      case 'summary':
        result = await generateSummaryReport(params ?? {});
        break;
      case 'program':
        result = await generateProgramReport(
          programId?.toString() ?? '',
          params ?? {},
        );
        break;
      case 'overdue':
        result = await generateOverdueReport(params ?? {});
        break;
      default:
        res.status(400).json({ error: `Unknown report type: ${type}` });
        return;
    }

    res.json({ reportId, type, result });
  } catch (error) {
    // If we have a reportId, mark the report as failed
    const { reportId } = req.query as { reportId?: string };
    if (reportId) {
      await failReport(
        reportId,
        error instanceof Error ? error.message : String(error),
      ).catch(() => {
        // Swallow -- already handling an error
      });
    }

    logger.error('Report data generation failed', {
      error: error instanceof Error ? error.message : String(error),
      reportId: req.query.reportId,
    });
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Complete Report (n8n posts results back)
// ---------------------------------------------------------------------------

/**
 * Stores the aggregation result in the ReportJob and notifies the user
 * via Socket.IO that their report is ready.
 *
 * Body: { reportId, result }
 */
export const completeReportHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { reportId, result } = req.body as {
      reportId?: string;
      result?: Record<string, unknown>;
    };

    // Inline validation
    if (!reportId || !result) {
      res.status(400).json({
        error: 'Missing required fields: reportId, result',
      });
      return;
    }

    const report = await completeReport(reportId, result);

    // Fire-and-forget: notify the requesting user via Socket.IO
    try {
      const io = getIO();
      const requestedByUserId = report.requestedBy.toString();

      // Iterate connected sockets to find the requesting user
      for (const [, socket] of io.sockets.sockets) {
        if (socket.data.userId === requestedByUserId) {
          socket.emit('report:completed' as SocketEventName, {
            event: 'report:completed',
            programId: report.programId?.toString() ?? '',
            data: {
              reportId: report._id.toString(),
              type: report.type,
              status: 'completed',
            },
            performedBy: { userId: 'system', name: 'System' },
            timestamp: Date.now(),
          } as unknown as SocketEventPayload);
        }
      }
    } catch {
      // Socket.IO not initialized -- no real-time notification, user can still poll
      logger.warn('Could not send report:completed socket event');
    }

    logger.debug(`Report ${reportId} completed successfully`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
