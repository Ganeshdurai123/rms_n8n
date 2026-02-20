import { AuditLog } from './auditLog.model.js';
import type { ListAuditLogsQuery } from './audit.schema.js';

/**
 * Get paginated admin audit logs with filtering.
 * Supports filtering by action, entityType, programId, requestId, performedBy, date range.
 */
export async function getAuditLogs(query: ListAuditLogsQuery) {
  const filter: Record<string, unknown> = {};

  // Build filter from query params
  if (query.action) {
    filter.action = query.action;
  }
  if (query.entityType) {
    filter.entityType = query.entityType;
  }
  if (query.programId) {
    filter.programId = query.programId;
  }
  if (query.requestId) {
    filter.requestId = query.requestId;
  }
  if (query.performedBy) {
    filter.performedBy = query.performedBy;
  }

  // Date range filtering
  if (query.startDate || query.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (query.startDate) {
      dateFilter.$gte = query.startDate;
    }
    if (query.endDate) {
      dateFilter.$lte = query.endDate;
    }
    filter.createdAt = dateFilter;
  }

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [auditLogs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('performedBy', 'firstName lastName email')
      .populate('requestId', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return { auditLogs, total, page, limit };
}

/**
 * Get paginated per-request audit trail.
 * Accessible to any program member (not admin-only).
 */
export async function getRequestAuditTrail(
  requestId: string,
  query: { page: number; limit: number },
) {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [auditLogs, total] = await Promise.all([
    AuditLog.find({ requestId })
      .populate('performedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments({ requestId }),
  ]);

  return { auditLogs, total, page, limit };
}
