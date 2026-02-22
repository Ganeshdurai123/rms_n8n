---
phase: 05-n8n-integration-notifications
plan: 03
subsystem: api
tags: [webhook, outbox-pattern, notification, fire-and-forget, express, mongoose]

# Dependency graph
requires:
  - phase: 05-n8n-integration-notifications
    plan: 01
    provides: Webhook outbox model, enqueueWebhookEvent service, startOutboxProcessor/stopOutboxProcessor
  - phase: 05-n8n-integration-notifications
    plan: 02
    provides: Notification model, createNotification fire-and-forget service
  - phase: 04-real-time-events
    provides: Socket.IO emitToProgram, getPerformerName pattern, fire-and-forget blocks
provides:
  - All 8 mutation paths enqueue webhook events to the outbox for n8n delivery
  - In-app notifications for status changes (creator + assignee), assignments (assignee), and comments (request creator)
  - Outbox processor starts on server boot (10s interval) and stops during graceful shutdown
affects: [05-04, n8n-workflows, 08-client-collaboration]

# Tech tracking
tech-stack:
  added: []
  patterns: [webhook-enqueue-inside-fire-and-forget-block, conditional-notification-creation]

key-files:
  created: []
  modified:
    - server/src/modules/request/request.service.ts
    - server/src/modules/request/comment.service.ts
    - server/src/modules/request/attachment.service.ts
    - server/src/server.ts

key-decisions:
  - "Webhook enqueue calls placed inside existing getPerformerName().then() blocks to reuse performer data and avoid double DB lookups"
  - "Notifications only for high-signal events: status changes, assignments, comments -- not for creates, updates, or attachment operations"
  - "Assignee notification suppressed when performer is the assignee (self-assignment doesn't notify)"
  - "Outbox processor interval set to 10 seconds for reasonable dispatch latency without excessive polling"

patterns-established:
  - "Webhook + notification wiring pattern: add enqueueWebhookEvent and conditional createNotification inside existing fire-and-forget .then() blocks"
  - "Notification guard pattern: compare userId strings to avoid notifying the performer of their own actions"

requirements-completed: [N8N-01]

# Metrics
duration: 5min
completed: 2026-02-22
---

# Phase 5 Plan 3: Webhook Dispatch and Notification Wiring Summary

**All 8 mutation paths enqueue webhook events to the outbox, status/assignment/comment notifications target relevant users, and outbox processor starts on server boot**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-22T14:40:35Z
- **Completed:** 2026-02-22T14:46:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Wired enqueueWebhookEvent into all 8 mutation paths (createRequest, updateRequest, transitionRequest, assignRequest, addComment, deleteComment, uploadAttachment, deleteAttachment)
- Added createNotification calls for status changes (notifies creator + assignee), assignments (notifies assignee), and comments (notifies request creator) with self-notification guards
- Started outbox processor on server boot with 10-second polling interval and clean shutdown integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire webhook dispatch and notifications into all mutation paths** - `47393a1` (feat)
2. **Task 2: Start outbox processor on server boot** - `2c666d2` (feat)

## Files Created/Modified
- `server/src/modules/request/request.service.ts` - Added enqueueWebhookEvent (4 calls) and createNotification (3 calls) for request CRUD, status transitions, and assignments
- `server/src/modules/request/comment.service.ts` - Added enqueueWebhookEvent (2 calls) and createNotification (1 call) for comment add/delete
- `server/src/modules/request/attachment.service.ts` - Added enqueueWebhookEvent (2 calls) for attachment upload/delete
- `server/src/server.ts` - Import and start outbox processor after Socket.IO init, stop during graceful shutdown

## Decisions Made
- Webhook enqueue calls placed inside existing `getPerformerName().then()` blocks to reuse the resolved performer object and avoid double DB lookups
- Notifications limited to high-signal events only: status changes, assignments, and comments -- attachment and create/update operations are low signal-to-noise
- Self-notification suppressed: assignee not notified when they assign to themselves; creator not notified when they transition their own request
- Outbox processor uses 10-second interval as a balance between dispatch latency and polling overhead

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. Outbox processor runs automatically and only dispatches when N8N_WEBHOOK_BASE_URL is set.

## Next Phase Readiness
- All mutation paths now fire webhook events to the outbox -- n8n workflows will receive events once N8N_WEBHOOK_BASE_URL is configured
- Notification system is fully wired -- users receive in-app notifications for status changes, assignments, and comments
- Plan 05-04 (n8n workflow templates and documentation) can proceed

## Self-Check: PASSED

- All 4 modified files verified present on disk
- Commit 47393a1 (Task 1) verified in git log
- Commit 2c666d2 (Task 2) verified in git log
- TypeScript compilation passes with zero errors
- 8 enqueueWebhookEvent calls confirmed across 3 service files
- 4 createNotification calls confirmed across 2 service files

---
*Phase: 05-n8n-integration-notifications*
*Completed: 2026-02-22*
