import { AuditLog } from './auditLog.model.js';
import type { AuditAction, AuditEntityType, IAuditLogDocument } from './auditLog.model.js';
import logger from '../../config/logger.js';

/**
 * Input data for creating an audit log entry.
 */
export interface CreateAuditEntryData {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  requestId: string;
  programId: string;
  performedBy: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Create an audit log entry for a mutation.
 *
 * Fire-and-forget pattern: logs errors but does NOT throw,
 * so audit failures never break the main operation.
 */
export async function createAuditEntry(
  data: CreateAuditEntryData,
): Promise<IAuditLogDocument | null> {
  try {
    const entry = await AuditLog.create(data);
    return entry;
  } catch (error) {
    logger.error('Failed to create audit log entry', {
      error: error instanceof Error ? error.message : String(error),
      data: {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        requestId: data.requestId,
      },
    });
    return null;
  }
}
