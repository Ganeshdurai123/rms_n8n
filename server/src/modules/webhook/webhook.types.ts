/**
 * Typed webhook event catalog -- single source of truth for all webhook
 * payload shapes used by the outbox pattern.
 *
 * These mirror the 8 mutation types from the audit log but at a coarser
 * granularity: `request.updated` covers field edits (the audit log
 * differentiates `request.field_edited` separately).
 */

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

/**
 * All webhook event types. Matches the AUDIT_ACTIONS from auditLog.model.ts
 * minus `request.field_edited` (folded into `request.updated`).
 */
export const WEBHOOK_EVENT_TYPES = [
  'request.created',
  'request.updated',
  'request.status_changed',
  'request.assigned',
  'request.deleted',
  'comment.added',
  'comment.deleted',
  'attachment.uploaded',
  'attachment.deleted',
  'report.requested',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

/**
 * Standard webhook payload shape delivered to n8n webhook endpoints.
 */
export interface WebhookPayload {
  /** The event that triggered this webhook */
  eventType: WebhookEventType;
  /** The program this event belongs to */
  programId: string;
  /** The affected request */
  requestId: string;
  /** Event-specific data (e.g., the request object, changed fields) */
  data: Record<string, unknown>;
  /** Who triggered this event */
  performedBy: { userId: string; name: string };
  /** ISO 8601 timestamp */
  timestamp: string;
}
