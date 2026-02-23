---
phase: 09-due-dates-reminders
plan: 01
subsystem: api
tags: [mongoose, zod, due-dates, reminders, mongodb-indexes]

# Dependency graph
requires:
  - phase: 02-programs-dynamic-fields
    provides: "Program model with fieldDefinitions, program.schema.ts Zod validation"
  - phase: 03-request-lifecycle-audit
    provides: "Request model with status/fields, request.service.ts createRequest/getRequests"
  - phase: 05-n8n-integration-notifications
    provides: "Internal API controller with getPendingReminders, webhook outbox"
provides:
  - "IDueDateConfig interface and dueDateConfig embedded subdocument on Program model"
  - "dueDate field on Request model with indexes"
  - "computeDueDate helper in request.service.ts"
  - "dueBefore/dueAfter query filters on request list and export APIs"
  - "dueDate-based pending-reminders internal API (overdue + upcoming)"
  - "Client TypeScript types for dueDate and dueDateConfig"
affects: [09-due-dates-reminders, n8n-workflows, client-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Computed field at creation: computeDueDate derives dueDate from program config at request creation time"
    - "Cross-document reference validation: dueDateField must reference a date-type fieldDefinition key"
    - "Dual-mode reminder query: $or combining overdue and upcoming conditions with type param filter"

key-files:
  created: []
  modified:
    - server/src/modules/program/program.model.ts
    - server/src/modules/program/program.schema.ts
    - server/src/modules/request/request.model.ts
    - server/src/modules/request/request.schema.ts
    - server/src/modules/request/request.service.ts
    - server/src/modules/internal/internal.controller.ts
    - client/src/lib/types.ts

key-decisions:
  - "dueDateConfig defaults: enabled=false, defaultOffsetDays=30 -- programs opt-in to due dates"
  - "computeDueDate prefers dueDateField value over defaultOffsetDays when both available"
  - "Compound index {programId, dueDate} for calendar/reminder queries"
  - "Pending reminders uses $or for combined overdue+upcoming when type param not specified"
  - "daysOverdue field uses negative values to indicate days until due (not yet overdue)"

patterns-established:
  - "Computed field at creation: derive and store computed values from parent document config"
  - "Cross-document Zod refinement: validate field references across schema objects"

requirements-completed: [DUE-01, DUE-02, DUE-04]

# Metrics
duration: 4min
completed: 2026-02-23
---

# Phase 9 Plan 1: Due Dates & Reminders Data Layer Summary

**dueDateConfig on programs with computed dueDate on requests, dueDate-based pending-reminders API replacing 48h staleness heuristic**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-23T09:14:28Z
- **Completed:** 2026-02-23T09:18:28Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Program model extended with dueDateConfig subdocument (enabled, defaultOffsetDays, dueDateField) for per-program due date configuration
- Request model extended with indexed dueDate field, computed at creation via computeDueDate helper
- Pending-reminders internal API rewritten to use actual dueDate queries (overdue + upcoming) with daysOverdue in response for n8n templates
- Client TypeScript types updated with dueDate on RequestItem and dueDateConfig on Program

## Task Commits

Each task was committed atomically:

1. **Task 1: Program dueDateConfig + Request dueDate model/schema/computation** - `35dd3b8` (feat)
2. **Task 2: Update pending-reminders API for due-date-based lookups** - `0b0a993` (feat)

## Files Created/Modified
- `server/src/modules/program/program.model.ts` - IDueDateConfig interface, dueDateConfig embedded subdocument on Program
- `server/src/modules/program/program.schema.ts` - dueDateConfig Zod validation with cross-reference refinement for dueDateField
- `server/src/modules/request/request.model.ts` - dueDate optional Date field with index, compound index {programId, dueDate}
- `server/src/modules/request/request.schema.ts` - dueDate in sortBy enum, dueBefore/dueAfter query filters
- `server/src/modules/request/request.service.ts` - computeDueDate helper, dueDate in createRequest, dueBefore/dueAfter in getRequests and exportRequestsCsv
- `server/src/modules/internal/internal.controller.ts` - Rewritten getPendingReminders with dueDate-based overdue/upcoming queries
- `client/src/lib/types.ts` - dueDate on RequestItem, dueDateConfig on Program interface

## Decisions Made
- dueDateConfig defaults to enabled=false with defaultOffsetDays=30 -- programs explicitly opt-in to due dates
- computeDueDate prefers dueDateField value from request fields over defaultOffsetDays when both are available
- Compound index {programId, dueDate} added for efficient calendar and reminder queries
- Pending reminders combines overdue and upcoming via $or when type param not specified
- daysOverdue uses negative values to indicate days until due (for n8n email template logic)
- dueBefore/dueAfter filters added to both getRequests and exportRequestsCsv for consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added dueBefore/dueAfter filters to exportRequestsCsv**
- **Found during:** Task 1
- **Issue:** Plan specified dueBefore/dueAfter for getRequests but exportRequestsCsv uses the same filter-building logic and would be inconsistent without them
- **Fix:** Added the same dueBefore/dueAfter filter block to exportRequestsCsv
- **Files modified:** server/src/modules/request/request.service.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 35dd3b8 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Auto-fix ensures consistent filtering across list and export APIs. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Due date data layer complete -- programs can configure due dates, requests store computed due dates
- Ready for Plan 02 (frontend due date indicators) and Plan 03 (n8n reminder workflow updates)
- Existing requests without dueDate are safely excluded from reminder queries via $exists filter

---
*Phase: 09-due-dates-reminders*
*Completed: 2026-02-23*
