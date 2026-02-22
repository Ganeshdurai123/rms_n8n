import { timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

/**
 * Shared-secret authentication middleware for the internal API.
 *
 * Compares the `x-api-key` header against `env.INTERNAL_API_KEY` using
 * timing-safe comparison to prevent timing attacks.
 *
 * Within Docker, n8n accesses `http://server:5000/api/v1/internal/` directly.
 * Nginx blocks external access to `/api/v1/internal/` (see default.conf).
 */
export const internalAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  const expected = env.INTERNAL_API_KEY;

  // Compare lengths first to avoid timing leak on different-length strings
  if (apiKey.length !== expected.length) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  const apiKeyBuffer = Buffer.from(apiKey);
  const expectedBuffer = Buffer.from(expected);

  if (!timingSafeEqual(apiKeyBuffer, expectedBuffer)) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  next();
};
