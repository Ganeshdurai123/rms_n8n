import type { Request, Response, NextFunction } from 'express';
import * as auditService from './audit.service.js';
import { paginatedResponse } from '../../middleware/pagination.js';

/**
 * GET /api/v1/admin/audit
 * List audit logs with filtering (admin-only).
 */
export async function listAuditLogs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { auditLogs, total, page, limit } = await auditService.getAuditLogs(
      req.query as any,
    );
    res.status(200).json(paginatedResponse(auditLogs as any[], total, page, limit));
  } catch (err) {
    next(err);
  }
}
