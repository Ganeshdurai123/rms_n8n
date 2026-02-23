/**
 * Socket.IO typed event catalog — single source of truth for all real-time
 * event names and payload shapes.
 *
 * Every mutation broadcast (Plan 04-02) uses these types to guarantee
 * consistent event shapes across server and client.
 */

// ---------------------------------------------------------------------------
// Event names
// ---------------------------------------------------------------------------

export type SocketEventName =
  | 'request:created'
  | 'request:updated'
  | 'request:status_changed'
  | 'request:assigned'
  | 'request:deleted'
  | 'comment:added'
  | 'comment:deleted'
  | 'attachment:uploaded'
  | 'attachment:deleted'
  | 'notification:created'
  | 'chain:step_advanced';

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

export interface SocketEventPayload {
  /** The event type */
  event: SocketEventName;
  /** The program room this belongs to */
  programId: string;
  /** The affected request */
  requestId: string;
  /** Event-specific data (e.g., the request object, comment object) */
  data: Record<string, unknown>;
  /** Who triggered this event */
  performedBy: { userId: string; name: string };
  /** ISO date string */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Socket.IO typed event maps
// ---------------------------------------------------------------------------

/** Events the server can emit to connected clients */
export interface ServerToClientEvents {
  'request:created': (payload: SocketEventPayload) => void;
  'request:updated': (payload: SocketEventPayload) => void;
  'request:status_changed': (payload: SocketEventPayload) => void;
  'request:assigned': (payload: SocketEventPayload) => void;
  'request:deleted': (payload: SocketEventPayload) => void;
  'comment:added': (payload: SocketEventPayload) => void;
  'comment:deleted': (payload: SocketEventPayload) => void;
  'attachment:uploaded': (payload: SocketEventPayload) => void;
  'attachment:deleted': (payload: SocketEventPayload) => void;
  'notification:created': (payload: SocketEventPayload) => void;
  'chain:step_advanced': (payload: SocketEventPayload) => void;
}

/** Events clients can emit to the server (empty in v1 — clients only receive) */
export interface ClientToServerEvents {}

/** Inter-server events (empty — single-server deployment) */
export interface InterServerEvents {}

/** Per-socket custom data attached during authentication */
export interface SocketData {
  userId: string;
  userRole: string;
  programs: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Redis TTL (seconds) for the per-room recent events sorted set used for reconnection catch-up */
export const RECENT_EVENTS_TTL = 300; // 5 minutes

/** Maximum number of events to send on reconnection catch-up */
export const MAX_CATCHUP_EVENTS = 50;
