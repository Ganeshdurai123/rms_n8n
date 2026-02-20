import type { Request, Response, NextFunction } from 'express';

export interface PaginationInfo {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Extend Express Request to include pagination
declare global {
  namespace Express {
    interface Request {
      pagination?: PaginationInfo;
    }
  }
}

/**
 * Pagination middleware.
 * Parses page and limit from query parameters and attaches pagination info to req.
 */
export function paginate(defaultLimit = 20, maxLimit = 100) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const rawLimit = parseInt(req.query.limit as string, 10) || defaultLimit;
    const limit = Math.min(Math.max(1, rawLimit), maxLimit);
    const skip = (page - 1) * limit;

    req.pagination = { page, limit, skip };
    next();
  };
}

/**
 * Helper to format a paginated response.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}
