---
phase: 06-sheet-views
plan: 01
subsystem: api
tags: [mongodb, csv-export, sorting, filtering, pagination, express]

# Dependency graph
requires:
  - phase: 03-request-lifecycle-audit
    provides: Request model, service, controller, routes with CRUD and status transitions
  - phase: 04-real-time-events
    provides: Socket.IO typed events and fire-and-forget emission pattern
  - phase: 05-n8n-integration-notifications
    provides: Webhook outbox pattern and notification service
provides:
  - Server-side sort on any standard request column via sortBy/sortOrder query params
  - Date range filtering via createdAfter/createdBefore query params
  - Custom field filtering via fields[key]=value query params on request.fields Map
  - CSV export endpoint with dynamic columns from program field definitions
  - Delete endpoint for draft requests with audit logging and real-time emission
affects: [06-sheet-views, 07-request-books]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic sort via computed property key with typed Record<string, 1 | -1>"
    - "CSV export with RFC 4180 field escaping via escapeCsvField helper"
    - "Dot-notation MongoDB queries for filtering Map fields (fields.key = value)"
    - "Boolean casting for checkbox field filter values (string 'true'/'false' to boolean)"

key-files:
  created: []
  modified:
    - server/src/modules/request/request.schema.ts
    - server/src/modules/request/request.service.ts
    - server/src/modules/request/request.controller.ts
    - server/src/modules/request/request.routes.ts
    - server/src/shared/socketEvents.ts
    - server/src/modules/audit/auditLog.model.ts
    - server/src/modules/webhook/webhook.types.ts

key-decisions:
  - "Checkbox field filter values cast from string 'true'/'false' to boolean for proper MongoDB Map matching"
  - "CSV escaping follows RFC 4180: double-quote wrapping for fields containing commas, quotes, or newlines"
  - "GET /export route placed before /:requestId to prevent Express misparse of 'export' as requestId"
  - "Sort type explicitly annotated as Record<string, 1 | -1> to satisfy Mongoose SortOrder type"

patterns-established:
  - "CSV export pattern: fetch all matching records (no pagination), build header + data rows with escapeCsvField"
  - "Dynamic sort pattern: sortBy/sortOrder query params with typed sort object"
  - "Custom field filter pattern: dot-notation into Mongoose Map fields"

requirements-completed: [SHEET-03, SHEET-04, SHEET-06, SHEET-07]

# Metrics
duration: 3min
completed: 2026-02-23
---

# Phase 6 Plan 1: Sort, Filter, CSV Export, Delete Summary

**Server-side sort/date-range/custom-field filtering, CSV export with dynamic program columns, and draft request deletion via extended request API**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T18:30:36Z
- **Completed:** 2026-02-22T18:34:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Extended request list endpoint with sortBy, sortOrder, createdAfter, createdBefore, and fields query params
- Added CSV export endpoint (GET /export) with dynamic field columns from program field definitions
- Added delete endpoint (DELETE /:requestId) for draft requests with audit logging and real-time emission
- Added request.deleted to audit actions, webhook event types, and Socket.IO event catalog

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sort, date range filter, and delete to request list/service** - `9eac73c` (feat)
2. **Task 2: Add CSV export and delete controller endpoints and routes** - `05c4edf` (feat)

## Files Created/Modified
- `server/src/modules/request/request.schema.ts` - Extended listRequestsQuerySchema with sortBy, sortOrder, createdAfter, createdBefore, fields params
- `server/src/modules/request/request.service.ts` - Added dynamic sort, date range filter, custom field filter, deleteRequest, exportRequestsCsv functions
- `server/src/modules/request/request.controller.ts` - Added exportCsv and remove controller handlers
- `server/src/modules/request/request.routes.ts` - Added GET /export and DELETE /:requestId routes
- `server/src/shared/socketEvents.ts` - Added request:deleted event to SocketEventName and ServerToClientEvents
- `server/src/modules/audit/auditLog.model.ts` - Added request.deleted to AUDIT_ACTIONS array
- `server/src/modules/webhook/webhook.types.ts` - Added request.deleted to WEBHOOK_EVENT_TYPES array

## Decisions Made
- Checkbox field filter values are cast from string 'true'/'false' to boolean for proper MongoDB Map matching (stored as booleans, but query params are always strings)
- CSV escaping follows RFC 4180 spec: double-quote wrapping for fields containing commas, quotes, or newlines, with inner quotes doubled
- GET /export route placed before /:requestId in router to prevent Express from parsing "export" as a requestId parameter
- Sort type explicitly annotated as `Record<string, 1 | -1>` to satisfy Mongoose SortOrder type constraint with computed property keys

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added request:deleted to Socket.IO event types**
- **Found during:** Task 1 (deleteRequest function)
- **Issue:** The deleteRequest function emits 'request:deleted' via emitToProgram, but this event was not in the SocketEventName type union or ServerToClientEvents interface, which would cause TypeScript errors
- **Fix:** Added 'request:deleted' to SocketEventName union and ServerToClientEvents interface in socketEvents.ts
- **Files modified:** server/src/shared/socketEvents.ts
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** 9eac73c (Task 1 commit)

**2. [Rule 3 - Blocking] Added request.deleted to AUDIT_ACTIONS**
- **Found during:** Task 1 (deleteRequest function)
- **Issue:** createAuditEntry with action 'request.deleted' requires the action to be in AUDIT_ACTIONS enum for Mongoose validation
- **Fix:** Added 'request.deleted' to AUDIT_ACTIONS array in auditLog.model.ts
- **Files modified:** server/src/modules/audit/auditLog.model.ts
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** 9eac73c (Task 1 commit)

**3. [Rule 3 - Blocking] Added request.deleted to WEBHOOK_EVENT_TYPES**
- **Found during:** Task 1 (deleteRequest function)
- **Issue:** enqueueWebhookEvent with type 'request.deleted' requires the type to be in WEBHOOK_EVENT_TYPES for type safety
- **Fix:** Added 'request.deleted' to WEBHOOK_EVENT_TYPES array in webhook.types.ts
- **Files modified:** server/src/modules/webhook/webhook.types.ts
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** 9eac73c (Task 1 commit)

**4. [Rule 1 - Bug] Fixed Mongoose SortOrder type constraint**
- **Found during:** Task 1 (dynamic sort implementation)
- **Issue:** Computed property `{ [sortField]: sortDirection }` inferred as `{ [x: string]: number }` which is not assignable to Mongoose SortOrder type
- **Fix:** Explicitly typed sortDirection as `1 | -1` and sortObj as `Record<string, 1 | -1>`
- **Files modified:** server/src/modules/request/request.service.ts
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** 9eac73c (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary for TypeScript compilation and runtime correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Request API now supports all query capabilities needed by the sheet view frontend (sort, date range, custom field filter, CSV export, delete)
- Ready for plan 06-02 (frontend sheet view UI implementation)
- All existing request API functionality preserved (no regressions verified via clean TypeScript compilation)

## Self-Check: PASSED

- All 7 modified files exist on disk
- Commit 9eac73c (Task 1) verified in git log
- Commit 05c4edf (Task 2) verified in git log

---
*Phase: 06-sheet-views*
*Completed: 2026-02-23*
