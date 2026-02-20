import { z } from 'zod';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from './auditLog.model.js';

/**
 * MongoDB ObjectId regex pattern for string validation.
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema for query parameters when listing audit logs.
 * Supports pagination, filtering by action/entity type/program/request/user, and date range.
 */
export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.enum(AUDIT_ACTIONS).optional(),
  entityType: z.enum(AUDIT_ENTITY_TYPES).optional(),
  programId: z.string().regex(objectIdRegex, 'Invalid program ID').optional(),
  requestId: z.string().regex(objectIdRegex, 'Invalid request ID').optional(),
  performedBy: z.string().regex(objectIdRegex, 'Invalid user ID').optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
