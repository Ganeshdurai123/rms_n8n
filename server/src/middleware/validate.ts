import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Generic Zod validation middleware factory.
 * Validates req[source] against the provided schema.
 * On success, replaces req[source] with parsed data (strips unknown fields).
 * On failure, passes ZodError to the error handler.
 */
export function validate(
  schema: ZodSchema,
  source: 'body' | 'query' | 'params' = 'body',
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(result.error);
      return;
    }

    // Replace with parsed data (strips unknown fields)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[source] = result.data;
    next();
  };
}
