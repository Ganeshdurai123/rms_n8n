import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import redis from './config/redis.js';
import logger from './config/logger.js';
import { seedAdmin } from './config/seed.js';
import { initSocketIO } from './config/socket.js';
import { startOutboxProcessor, stopOutboxProcessor } from './modules/webhook/webhook.service.js';

const server = http.createServer(app);

// Module-scope handle for the outbox processor interval (for clean shutdown)
let outboxHandle: NodeJS.Timeout | null = null;

async function start(): Promise<void> {
  try {
    // 1. Environment validated on import (env.ts triggers Zod validation)
    logger.info(`Environment: ${env.NODE_ENV}`);

    // 2. Connect to MongoDB
    await connectDB();

    // 3. Seed default admin user (first boot only)
    await seedAdmin();

    // 4. Verify Redis connection
    const pong = await redis.ping();
    logger.info(`Redis ping: ${pong}`);

    // 4.5. Initialize Socket.IO
    initSocketIO(server);
    logger.info('Socket.IO initialized');

    // 4.6. Start webhook outbox processor
    outboxHandle = startOutboxProcessor(10_000); // Process every 10 seconds
    logger.info('Webhook outbox processor started');

    // 5. Start HTTP server
    server.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop outbox processor
  if (outboxHandle) {
    stopOutboxProcessor(outboxHandle);
    logger.info('Webhook outbox processor stopped');
  }

  // Close Socket.IO before HTTP server
  try {
    const { getIO } = await import('./config/socket.js');
    const ioInstance = getIO();
    ioInstance.close();
    logger.info('Socket.IO closed');
  } catch {
    /* Socket.IO not initialized — nothing to close */
  }

  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    await disconnectDB();
    logger.info('MongoDB disconnected');
  } catch (err) {
    logger.error('Error disconnecting MongoDB:', err);
  }

  try {
    await redis.quit();
    logger.info('Redis disconnected');
  } catch (err) {
    logger.error('Error disconnecting Redis:', err);
  }

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
