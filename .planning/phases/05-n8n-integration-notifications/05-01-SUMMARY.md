---
phase: 05-n8n-integration-notifications
plan: 01
subsystem: api
tags: [webhook, outbox-pattern, socket.io, internal-api, shared-secret-auth, n8n]

# Dependency graph
requires:
  - phase: 04-real-time-events
    provides: Socket.IO infrastructure (getIO, emitToProgram, typed events)
  - phase: 03-request-lifecycle-audit
    provides: Audit log model (AUDIT_ACTIONS) and fire-and-forget pattern
provides:
  - WebhookEvent outbox model with pending/sent/failed lifecycle and exponential retry
  - Typed webhook event catalog (WebhookEventType, WebhookPayload)
  - Outbox service (enqueue, processOutbox, startOutboxProcessor)
  - Internal API with shared-secret auth (internalAuth middleware)
  - Socket-emit endpoint for n8n to push real-time events to program rooms
affects: [05-02, 05-03, 05-04, n8n-workflows]

# Tech tracking
tech-stack:
  added: [native-fetch]
  patterns: [outbox-pattern, shared-secret-auth, timing-safe-comparison]

key-files:
  created:
    - server/src/modules/webhook/webhook.types.ts
    - server/src/modules/webhook/webhookEvent.model.ts
    - server/src/modules/webhook/webhookEvent.schema.ts
    - server/src/modules/webhook/webhook.service.ts
    - server/src/middleware/internalAuth.ts
    - server/src/modules/internal/internal.controller.ts
    - server/src/modules/internal/internal.routes.ts
  modified:
    - server/src/app.ts

key-decisions:
  - "Outbox stores events even when N8N_WEBHOOK_BASE_URL is unset -- events accumulate for later dispatch"
  - "Exponential backoff uses retryCount * 30s formula for simple, predictable retry spacing"
  - "internalAuth uses crypto.timingSafeEqual with Buffer.from() and length pre-check to prevent timing attacks"
  - "Socket-emit constructs SocketEventPayload from n8n request body to satisfy typed Socket.IO emit signature"

patterns-established:
  - "Outbox pattern: enqueue fire-and-forget, dispatch via interval processor with exponential backoff"
  - "Shared-secret auth: x-api-key header compared with timing-safe comparison"
  - "Internal API: nginx-blocked externally, accessible within Docker network only"

requirements-completed: [N8N-02, N8N-03, N8N-04, N8N-05]

# Metrics
duration: 13min
completed: 2026-02-22
---

# Phase 5 Plan 1: Webhook Outbox, Event Catalog, and Internal API Summary

**Webhook outbox with exponential retry, typed event catalog for 8 mutation types, and internal API with timing-safe shared-secret auth for n8n integration**

## Performance

- **Duration:** 13 min
- **Started:** 2026-02-22T14:23:52Z
- **Completed:** 2026-02-22T14:37:14Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- WebhookEvent Mongoose model with outbox pattern (pending/sent/failed status, retry tracking, exponential backoff)
- Typed webhook event catalog covering all 8 mutation types as single source of truth for n8n payloads
- Internal API secured with shared-secret auth (timing-safe comparison) and blocked by nginx externally
- Socket-emit endpoint allows n8n to push real-time typed events to program-scoped Socket.IO rooms

## Task Commits

Each task was committed atomically:

1. **Task 1: Webhook outbox model, typed event catalog, and outbox service** - `77c2889` (feat)
2. **Task 2: Internal API middleware and routes with socket-emit endpoint** - `38f1251` (feat)

## Files Created/Modified
- `server/src/modules/webhook/webhook.types.ts` - Typed webhook event catalog (WebhookEventType, WebhookPayload, WEBHOOK_EVENT_TYPES)
- `server/src/modules/webhook/webhookEvent.model.ts` - WebhookEvent Mongoose model with status lifecycle and retry tracking
- `server/src/modules/webhook/webhookEvent.schema.ts` - Zod query schema for admin outbox listing
- `server/src/modules/webhook/webhook.service.ts` - Outbox enqueue, dispatch with exponential backoff, interval processor
- `server/src/middleware/internalAuth.ts` - Shared-secret auth middleware with crypto.timingSafeEqual
- `server/src/modules/internal/internal.controller.ts` - Health check and socket-emit controllers
- `server/src/modules/internal/internal.routes.ts` - Internal API router with auth middleware
- `server/src/app.ts` - Mounted internalRouter at /api/v1/internal before 404 handler

## Decisions Made
- Outbox stores events even when N8N_WEBHOOK_BASE_URL is unset so events accumulate for when n8n comes online later
- Exponential backoff uses retryCount * 30s formula (simple, predictable: 30s, 60s, 90s)
- internalAuth uses crypto.timingSafeEqual with Buffer.from() and length pre-check to prevent timing attacks
- Socket-emit constructs full SocketEventPayload from n8n request body fields to satisfy typed Socket.IO emit signature
- processOutbox uses native fetch (Node 18+) for HTTP calls to n8n webhook endpoints

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Socket.IO emit type mismatch in socketEmit controller**
- **Found during:** Task 2 (Internal API middleware and routes)
- **Issue:** TypeScript rejected `Record<string, unknown>` as argument to typed Socket.IO emit which expects `SocketEventPayload`
- **Fix:** Used `as unknown as SocketEventPayload` cast since internal API is trusted and n8n sends valid payloads
- **Files modified:** server/src/modules/internal/internal.controller.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** 38f1251

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Type cast necessary for TypeScript strict mode compatibility. No scope creep.

## Issues Encountered
None beyond the type mismatch documented in deviations.

## User Setup Required
None - no external service configuration required. Environment variables (N8N_WEBHOOK_BASE_URL, N8N_WEBHOOK_SECRET, INTERNAL_API_KEY) were already defined in env.ts from Phase 1.

## Next Phase Readiness
- Webhook outbox infrastructure ready for Plans 05-02 through 05-04 to enqueue events during mutations
- Internal API ready for n8n workflows to call back into Express for socket emissions
- Outbox processor can be started in server.ts when n8n is configured

## Self-Check: PASSED

- All 8 files verified present on disk
- Commit 77c2889 (Task 1) verified in git log
- Commit 38f1251 (Task 2) verified in git log
- TypeScript compilation passes with zero errors

---
*Phase: 05-n8n-integration-notifications*
*Completed: 2026-02-22*
