import type { Request, Response } from 'express';
import { getIO } from '../../config/socket.js';
import logger from '../../config/logger.js';
import type { SocketEventName, SocketEventPayload } from '../../shared/socketEvents.js';

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
