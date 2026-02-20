---
phase: 03-request-lifecycle-audit
plan: 02
subsystem: api
tags: [express, mongoose, state-machine, audit-log, request-lifecycle, caching, access-scoping]

# Dependency graph
requires:
  - phase: 03-request-lifecycle-audit
    provides: "Request model, stateMachine, audit utility, Zod schemas from Plan 01"
  - phase: 02-programs-dynamic-fields
    provides: "Program model with fieldDefinitions, getProgramById, checkProgramTimeframe, authorizeProgram middleware"
  - phase: 01-foundation-authentication
    provides: "User model, authenticate middleware, Role types, error classes, cache utilities"
provides:
  - "Request CRUD service with dynamic field validation against program fieldDefinitions"
  - "State machine transitions enforced via transitionRequest with role-based authorization"
  - "Request assignment/reassignment with program member validation"
  - "Audit logging on every mutation (create, update, transition, assign)"
  - "Access-scoped request listing: clients own-only, team_member own+assigned, admin/manager all"
  - "Request routes at /api/v1/programs/:programId/requests with full middleware chain"
affects: [03-request-lifecycle-audit, 04-real-time-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [service-layer-crud, dynamic-field-validation, access-scoped-listing, nested-program-routes]

key-files:
  created:
    - server/src/modules/request/request.service.ts
    - server/src/modules/request/request.controller.ts
    - server/src/modules/request/request.routes.ts
  modified:
    - server/src/app.ts

key-decisions:
  - "Dynamic field validation in service layer using validateFields helper -- checks required, type correctness, dropdown options, and rejects unknown fields"
  - "Access scoping in getRequests: clients see createdBy:userId, team_members see createdBy OR assignedTo, admin/manager see all"
  - "Creator-only submit rule: draft->submitted and rejected->submitted transitions require request.createdBy === userId"
  - "Assignment restricted to active program members with team_member or manager role"

patterns-established:
  - "Nested route mounting: app.use('/api/v1/programs/:programId/requests', requestRouter) with Router({ mergeParams: true })"
  - "Service-layer field validation: validateFields(fields, fieldDefinitions) as reusable pattern for dynamic forms"
  - "Access-scoped listing with $or/$and composition for combining role filter with search filter"

requirements-completed: [REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-09, REQ-10, AUDIT-01]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 3 Plan 02: Request CRUD + State Transitions + Assignment + Audit Summary

**Request lifecycle API with dynamic field validation, state machine transitions, role-based assignment, and audit logging on every mutation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T17:33:08Z
- **Completed:** 2026-02-20T17:36:16Z
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 1

## Accomplishments
- Complete request service layer with 6 functions: createRequest, getRequestById, getRequests, updateRequest, transitionRequest, assignRequest
- Dynamic field validation enforcing required fields, type correctness, dropdown options, and rejecting unknown field keys
- State machine transitions with role-based authorization and creator-only submit/resubmit rule
- Access-scoped request listing: clients see own requests, team members see own + assigned, admin/manager see all
- Audit log entry created for every mutation operation (create, update, field_edited, status_changed, assigned)

## Task Commits

Each task was committed atomically:

1. **Task 1: Request service with CRUD, state transitions, assignment, and audit logging** - `573b06a` (feat)
2. **Task 2: Request controller, routes, and app.ts mount** - `d0705df` (feat)

## Files Created/Modified
- `server/src/modules/request/request.service.ts` - Request business logic: CRUD, transitions, assignment, audit logging, field validation
- `server/src/modules/request/request.controller.ts` - Thin Express controllers delegating to service layer
- `server/src/modules/request/request.routes.ts` - Routes with authenticate -> authorizeProgram -> validate -> controller chain
- `server/src/app.ts` - Mounted requestRouter at /api/v1/programs/:programId/requests

## Decisions Made
- Dynamic field validation uses a dedicated `validateFields` helper in the service layer that validates against program `fieldDefinitions` -- enforces required, type, options, and rejects unknown keys
- Access scoping in `getRequests` uses `$or` for team_member role and `$and` composition when search is combined with role-based access filters (same pattern as program.service.ts)
- Creator-only submit rule added beyond state machine: only `request.createdBy === userId` can trigger `draft->submitted` or `rejected->submitted` transitions
- Assignment validates that assignee has `team_member` or `manager` role in the program via ProgramMember lookup (not just any member)
- Used `as any` cast for lean query results in paginatedResponse since lean() returns plain objects (Map becomes Record), same pattern as program controller

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript compilation errors in controller**
- **Found during:** Task 2 (controller implementation)
- **Issue:** `req.params.requestId` typed as `string | string[]` in Express with mergeParams, and lean query results incompatible with IRequestDocument (Map vs Record)
- **Fix:** Added `as string` casts for params and `as any[]` for lean results in paginatedResponse
- **Files modified:** `server/src/modules/request/request.controller.ts`
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** `d0705df` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Standard TypeScript type narrowing fix. No scope creep.

## Issues Encountered

None beyond the TypeScript type fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Request CRUD + lifecycle API fully operational for Plan 03 (Comments, Attachments, Audit Views)
- State machine and audit utility patterns proven and ready for extension
- Access-scoped listing pattern established for reuse in comments/attachments
- Routes nested under programs enable consistent program-scoped authorization

## Self-Check: PASSED

- All 3 source files + 1 modified: FOUND
- SUMMARY.md: FOUND
- Commit 573b06a (Task 1): FOUND
- Commit d0705df (Task 2): FOUND

---
*Phase: 03-request-lifecycle-audit*
*Completed: 2026-02-20*
