import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import redis from './config/redis.js';
import logger from './config/logger.js';
import { seedAdmin } from './config/seed.js';

const server = http.createServer(app);

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
