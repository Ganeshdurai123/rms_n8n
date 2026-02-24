import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import { z } from 'zod';
import logger from './logger.js';

const envSchema = z.object({
  // MongoDB
  MONGO_URI: z.string().url(),

  // Redis
  REDIS_URL: z.string(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Server
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Client
  CLIENT_URL: z.string().default('http://localhost'),

  // n8n
  N8N_WEBHOOK_BASE_URL: z.string().url().optional(),
  N8N_WEBHOOK_SECRET: z.string().optional(),

  // Internal API
  INTERNAL_API_KEY: z.string().min(32),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    logger.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;
