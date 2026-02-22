---
phase: 04-real-time-events
plan: 01
subsystem: api
tags: [socket.io, jwt, redis, real-time, websocket]

# Dependency graph
requires:
  - phase: 03-request-lifecycle-audit
    provides: "Request, Comment, Attachment models and CRUD services that produce mutations to broadcast"
  - phase: 01-foundation-authentication
    provides: "JWT access tokens (env.JWT_ACCESS_SECRET) for Socket.IO auth, ProgramMember model for room assignment"
provides:
  - "Socket.IO server with JWT authentication middleware"
  - "Program-scoped rooms (program:{programId}) for event isolation"
  - "emitToProgram() utility for broadcasting events to program rooms"
  - "Redis-backed reconnection catch-up via sorted sets with TTL expiry"
  - "Typed event catalog (SocketEventName, SocketEventPayload, ServerToClientEvents)"
affects: [04-02-mutation-broadcasting, 05-n8n-notifications, 08-client-collaboration]

# Tech tracking
tech-stack:
  added: [socket.io v4.8.3]
  patterns: [program-scoped-rooms, redis-sorted-set-catchup, typed-socket-events, fire-and-forget-emit]

key-files:
  created:
    - server/src/shared/socketEvents.ts
    - server/src/config/socket.ts
  modified:
    - server/src/server.ts
    - server/package.json
    - server/package-lock.json

key-decisions:
  - "Socket.IO JWT auth via socket.handshake.auth.token (standard Socket.IO auth field, not query params)"
  - "Program rooms use 'program:{programId}' naming convention for namespace clarity"
  - "Redis sorted sets (ZADD/ZRANGEBYSCORE) for reconnection catch-up with 5-min TTL and max 50 events"
  - "emitToProgram is fire-and-forget -- if Socket.IO not initialized, logs warning and returns (matches audit pattern)"
  - "ClientToServerEvents empty for v1 -- clients only receive, never push events to server"

patterns-established:
  - "Program-scoped rooms: all real-time events are scoped to program:{programId} rooms, never global"
  - "Typed event catalog: all event names and payloads defined in socketEvents.ts as single source of truth"
  - "Fire-and-forget emit: emitToProgram never throws, matches audit utility pattern from Phase 3"
  - "Redis catch-up: sorted set per room with ZRANGEBYSCORE for efficient range queries on reconnection"

requirements-completed: [RT-01, RT-03, RT-04]

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 4 Plan 1: Socket.IO Infrastructure Summary

**Socket.IO server with JWT auth middleware, program-scoped rooms via ProgramMember lookup, and Redis sorted-set reconnection catch-up**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T04:23:02Z
- **Completed:** 2026-02-22T04:27:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Socket.IO server initialized on existing HTTP server with typed event maps (ServerToClientEvents, ClientToServerEvents, InterServerEvents, SocketData)
- JWT authentication middleware rejects unauthenticated/expired/inactive connections with descriptive error messages
- Authenticated users auto-join program-scoped rooms based on ProgramMember.find() lookup of active memberships
- Reconnection catch-up reads missed events from Redis sorted sets using ZRANGEBYSCORE with exclusive lower bound
- emitToProgram() utility stores events in Redis for catch-up and trims old entries beyond TTL window
- Graceful shutdown closes Socket.IO before HTTP server in shutdown sequence

## Task Commits

Each task was committed atomically:

1. **Task 1: Install socket.io and create typed event catalog** - `24fc9a9` (feat)
2. **Task 2: Create Socket.IO server with JWT auth, room management, and reconnection** - `7bc471c` (feat)

## Files Created/Modified
- `server/src/shared/socketEvents.ts` - Typed event catalog with SocketEventName union, SocketEventPayload interface, ServerToClientEvents/ClientToServerEvents/InterServerEvents/SocketData interfaces, RECENT_EVENTS_TTL and MAX_CATCHUP_EVENTS constants
- `server/src/config/socket.ts` - Socket.IO server initialization, JWT auth middleware, room join logic, reconnection catch-up handler, emitToProgram utility, getIO accessor
- `server/src/server.ts` - Updated to call initSocketIO(server) after Redis verification, added Socket.IO graceful shutdown before HTTP server close
- `server/package.json` - Added socket.io ^4.8.3 dependency
- `server/package-lock.json` - Lock file updated with socket.io and transitive dependencies

## Decisions Made
- Socket.IO JWT auth via `socket.handshake.auth.token` (standard Socket.IO auth field) rather than query params or cookies -- cleaner separation from HTTP auth
- Program rooms use `program:{programId}` naming convention for clear namespace identification
- Redis sorted sets (ZADD scored by timestamp, ZRANGEBYSCORE for range queries) for reconnection catch-up with 5-min TTL and max 50 events -- efficient bounded storage
- emitToProgram is fire-and-forget: if Socket.IO not initialized, logs warning and returns (matches audit utility pattern from Phase 3)
- ClientToServerEvents left empty for v1 -- clients only receive events, server-to-client only

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- emitToProgram() utility is ready for Plan 04-02 to wire into all mutation paths (request CRUD, transitions, assignments, comments, attachments)
- Typed event catalog provides type safety for all event emission calls
- Redis catch-up infrastructure is in place for clients that reconnect after brief disconnections

## Self-Check: PASSED

- FOUND: server/src/shared/socketEvents.ts
- FOUND: server/src/config/socket.ts
- FOUND: server/src/server.ts
- FOUND: 04-01-SUMMARY.md
- FOUND: commit 24fc9a9
- FOUND: commit 7bc471c

---
*Phase: 04-real-time-events*
*Completed: 2026-02-22*
