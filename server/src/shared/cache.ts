import redis from '../config/redis.js';
import logger from '../config/logger.js';

/** Default TTL for list query caches (5 minutes) */
export const CACHE_TTL_LIST = 300;

/** Default TTL for configuration caches (15 minutes) */
export const CACHE_TTL_CONFIG = 900;

/**
 * Get a cached value by key. Returns null on cache miss or parse error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (data === null) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    logger.error(`Cache get error for key "${key}":`, err);
    return null;
  }
}

/**
 * Set a value in cache with optional TTL in seconds.
 */
export async function cacheSet(
  key: string,
  data: unknown,
  ttlSeconds?: number,
): Promise<void> {
  try {
    const serialized = JSON.stringify(data);
    if (ttlSeconds) {
      await redis.set(key, serialized, 'EX', ttlSeconds);
    } else {
      await redis.set(key, serialized);
    }
  } catch (err) {
    logger.error(`Cache set error for key "${key}":`, err);
  }
}

/**
 * Invalidate all cache keys matching a pattern.
 * Uses SCAN instead of KEYS for production safety.
 */
export async function cacheInvalidate(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug(`Cache invalidated ${keys.length} keys matching "${pattern}"`);
    }
  } catch (err) {
    logger.error(`Cache invalidate error for pattern "${pattern}":`, err);
  }
}
