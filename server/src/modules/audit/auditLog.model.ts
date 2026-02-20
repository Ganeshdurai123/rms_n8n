import mongoose, { Schema, Document } from 'mongoose';

/**
 * Valid audit log actions capturing all mutation types across the request lifecycle.
 */
export const AUDIT_ACTIONS = [
  'request.created',
  'request.updated',
  'request.status_changed',
  'request.assigned',
  'request.field_edited',
  'comment.added',
  'comment.deleted',
  'attachment.uploaded',
  'attachment.deleted',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Entity types that can be audited.
 */
export const AUDIT_ENTITY_TYPES = ['request', 'comment', 'attachment'] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/**
 * AuditLog document interface.
 * Captures who, what, when, before/after for every mutation.
 */
export interface IAuditLogDocument extends Document {
  _id: mongoose.Types.ObjectId;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: mongoose.Types.ObjectId;
  requestId: mongoose.Types.ObjectId;
  programId: mongoose.Types.ObjectId;
  performedBy: mongoose.Types.ObjectId;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * AuditLog schema -- immutable record of every mutation for compliance and traceability.
 */
const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      enum: {
        values: AUDIT_ACTIONS,
        message: 'Invalid audit action: {VALUE}',
      },
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      enum: {
        values: AUDIT_ENTITY_TYPES,
        message: 'Invalid entity type: {VALUE}',
      },
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Entity ID is required'],
    },
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'Request',
      required: [true, 'Request ID is required'],
      index: true,
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
      required: [true, 'Program ID is required'],
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Performed by user is required'],
    },
    before: {
      type: Schema.Types.Mixed,
    },
    after: {
      type: Schema.Types.Mixed,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for common query patterns
auditLogSchema.index({ requestId: 1, createdAt: -1 }); // Per-request audit trail
auditLogSchema.index({ programId: 1, createdAt: -1 }); // Program-level audit
auditLogSchema.index({ performedBy: 1 }); // User activity lookup
auditLogSchema.index({ action: 1, createdAt: -1 }); // Admin filtering by action type

export const AuditLog = mongoose.model<IAuditLogDocument>(
  'AuditLog',
  auditLogSchema,
);
