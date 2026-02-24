---
phase: 13-enhanced-program-boundaries
plan: 01
subsystem: api
tags: [mongoose, zod, boundary-enforcement, rate-limiting, aggregation]

# Dependency graph
requires:
  - phase: 02-programs-dynamic-fields
    provides: Program model with settings subdocument and maxActiveRequests field
  - phase: 03-request-lifecycle-audit
    provides: Request model, createRequest service, status lifecycle
provides:
  - maxActiveRequestsPerUser field in Program settings for per-user active request caps
  - checkBoundaryLimits enforcement in request creation (program-wide + per-user)
  - GET /api/v1/programs/:programId/boundary-stats endpoint with usage vs limits data
affects: [13-02-enhanced-program-boundaries]

# Tech tracking
tech-stack:
  added: []
  patterns: [boundary-enforcement-before-creation, aggregation-pipeline-with-lookup]

key-files:
  created: []
  modified:
    - server/src/modules/program/program.model.ts
    - server/src/modules/program/program.schema.ts
    - server/src/modules/program/program.service.ts
    - server/src/modules/program/program.controller.ts
    - server/src/modules/program/program.routes.ts
    - server/src/modules/request/request.service.ts

key-decisions:
  - "maxActiveRequestsPerUser min(1) not min(0) -- a limit of 0 would block all users, which is nonsensical"
  - "Active statuses for boundary counting: submitted, in_review, approved (draft/completed/rejected excluded)"
  - "checkBoundaryLimits placed after timeframe check but before field validation in createRequest"
  - "Import Request model as RequestDoc in program.service.ts to avoid naming confusion"

patterns-established:
  - "Boundary enforcement pattern: check limits before document creation, not after"
  - "Aggregation pipeline with $lookup for per-user stats in boundary stats endpoint"

requirements-completed: [BOUND-01, BOUND-02, BOUND-03]

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 13 Plan 01: Enhanced Program Boundaries Summary

**Per-user active request limits with dual boundary enforcement (program-wide + per-user) and boundary utilization stats API**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T06:59:10Z
- **Completed:** 2026-02-24T07:02:10Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added maxActiveRequestsPerUser optional field to Program model settings and Zod schemas
- Implemented checkBoundaryLimits function enforcing both program-wide and per-user active request caps with clear error messages
- Created GET /api/v1/programs/:programId/boundary-stats endpoint returning limits, total active count, and per-user breakdown via aggregation pipeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Add maxActiveRequestsPerUser to Program model and Zod schemas** - `bdd6541` (feat)
2. **Task 2: Enforce boundary limits on request creation and add boundary stats API** - `75b5364` (feat)

## Files Created/Modified
- `server/src/modules/program/program.model.ts` - Added maxActiveRequestsPerUser to IProgramDocument interface and Mongoose schema settings
- `server/src/modules/program/program.schema.ts` - Added maxActiveRequestsPerUser Zod validation (int, min 1, optional) to create and update schemas
- `server/src/modules/request/request.service.ts` - Added checkBoundaryLimits function and boundary check call in createRequest
- `server/src/modules/program/program.service.ts` - Added getBoundaryStats function with mongoose aggregation pipeline
- `server/src/modules/program/program.controller.ts` - Added getBoundaryStats controller handler
- `server/src/modules/program/program.routes.ts` - Added GET /:programId/boundary-stats route with admin/manager + authorizeProgram

## Decisions Made
- maxActiveRequestsPerUser uses min(1) validation (not min(0) like maxActiveRequests) because a limit of 0 would nonsensically block all users
- Active statuses for boundary counting are submitted, in_review, approved -- draft and completed/rejected don't consume capacity
- checkBoundaryLimits is called after timeframe check but before field validation in createRequest flow
- Request model imported as RequestDoc in program.service.ts to avoid potential naming confusion with Express Request

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Boundary enforcement backend complete, ready for frontend UI in 13-02
- Boundary stats API available for admin dashboard integration

## Self-Check: PASSED

All 6 modified files verified on disk. Both task commits (bdd6541, 75b5364) verified in git log.

---
*Phase: 13-enhanced-program-boundaries*
*Completed: 2026-02-24*
