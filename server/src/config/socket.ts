import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env.js';
import redis from './redis.js';
import logger from './logger.js';
import { User } from '../modules/auth/auth.model.js';
import { ProgramMember } from '../modules/user/programMember.model.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  SocketEventName,
  SocketEventPayload,
} from '../shared/socketEvents.js';
import { RECENT_EVENTS_TTL, MAX_CATCHUP_EVENTS } from '../shared/socketEvents.js';

// ---------------------------------------------------------------------------
// Module-scoped io instance
// ---------------------------------------------------------------------------

let io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Create and configure the Socket.IO server attached to an existing HTTP server.
 *
 * - JWT authentication middleware rejects unauthenticated connections
 * - Authenticated users auto-join program-scoped rooms
 * - Reconnection with `lastEventTimestamp` triggers catch-up from Redis
 */
export function initSocketIO(
  httpServer: http.Server,
): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // -----------------------------------------------------------------------
  // JWT Authentication Middleware
  // -----------------------------------------------------------------------

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token as string | undefined;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      let decoded: jwt.JwtPayload;
      try {
        decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
      } catch {
        return next(new Error('Invalid or expired token'));
      }

      const userId = decoded.sub;
      if (!userId) {
        return next(new Error('Invalid token payload'));
      }

      const user = await User.findById(userId).select('firstName lastName email role isActive');
      if (!user || user.isActive === false) {
        return next(new Error('User not found or inactive'));
      }

      // Attach user info to socket data
      socket.data.userId = user._id.toString();
      socket.data.userRole = user.role;
      socket.data.programs = []; // filled in connection handler

      next();
    } catch (err) {
      logger.error('Socket auth middleware error:', err);
      next(new Error('Authentication failed'));
    }
  });

  // -----------------------------------------------------------------------
  // Connection Handler
  // -----------------------------------------------------------------------

  io.on('connection', async (socket) => {
    logger.info(`Socket connected: ${socket.id} (user: ${socket.data.userId})`);

    // --- Room Join ---
    try {
      const memberships = await ProgramMember.find({
        userId: socket.data.userId,
        isActive: true,
      })
        .select('programId')
        .lean();

      const programIds = memberships.map((m) => m.programId.toString());
      socket.data.programs = programIds;

      for (const programId of programIds) {
        socket.join(`program:${programId}`);
      }

      logger.debug(`User ${socket.data.userId} joined rooms: ${programIds.join(', ')}`);
    } catch (err) {
      logger.error(`Failed to join program rooms for user ${socket.data.userId}:`, err);
    }

    // --- Reconnection Catch-Up ---
    const lastEventTimestamp = socket.handshake.auth.lastEventTimestamp as number | undefined;
    if (lastEventTimestamp && socket.data.programs.length > 0) {
      try {
        for (const programId of socket.data.programs) {
          const redisKey = `socket:events:program:${programId}`;
          const rawEvents = await redis.zrangebyscore(
            redisKey,
            `(${lastEventTimestamp}`, // exclusive lower bound
            '+inf',
            'LIMIT',
            0,
            MAX_CATCHUP_EVENTS,
          );

          for (const raw of rawEvents) {
            try {
              const payload = JSON.parse(raw) as SocketEventPayload;
              socket.emit(payload.event, payload);
            } catch {
              logger.warn(`Failed to parse catch-up event from Redis key ${redisKey}`);
            }
          }
        }
      } catch (err) {
        logger.error('Reconnection catch-up failed:', err);
      }
    }

    // --- Disconnect Handler ---
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (reason: ${reason})`);
    });
  });

  return io;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Emit an event to all sockets in a program room and store in Redis for catch-up.
 *
 * Fire-and-forget: if Socket.IO is not initialized, logs a warning and returns.
 */
export function emitToProgram(
  programId: string,
  event: SocketEventName,
  payload: SocketEventPayload,
): void {
  if (!io) {
    logger.warn('emitToProgram called before Socket.IO initialization');
    return;
  }

  // Emit to program room
  io.to(`program:${programId}`).emit(event, payload);

  // Store in Redis sorted set for reconnection catch-up
  const redisKey = `socket:events:program:${programId}`;
  const score = Date.now();

  redis
    .zadd(redisKey, score, JSON.stringify(payload))
    .then(() => redis.expire(redisKey, RECENT_EVENTS_TTL))
    .then(() =>
      // Trim old entries beyond TTL window to prevent unbounded growth
      redis.zremrangebyscore(redisKey, '-inf', score - RECENT_EVENTS_TTL * 1000),
    )
    .catch((err) => {
      logger.error(`Failed to store event in Redis for program ${programId}:`, err);
    });
}

/**
 * Get the Socket.IO server instance. Throws if not initialized.
 */
export function getIO(): Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  if (!io) {
    throw new Error('Socket.IO not initialized — call initSocketIO first');
  }
  return io;
}
