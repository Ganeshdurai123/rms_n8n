---
phase: 02-programs-dynamic-fields
plan: 02
subsystem: api
tags: [express, middleware, rbac, program-scoping, member-management, authorization]

# Dependency graph
requires:
  - phase: 01-foundation-authentication
    provides: "Express app, auth middleware, authorize middleware, User model, cache utilities, pagination, error classes"
  - phase: 02-programs-dynamic-fields
    provides: "Program model, program CRUD service/controller/routes, Zod schemas, ProgramMember model"
provides:
  - "authorizeProgram middleware with admin bypass and ProgramMember lookup"
  - "Access-scoped program listing (non-admin users see only their programs)"
  - "Program member management CRUD (add, remove, list members)"
  - "checkProgramTimeframe utility for Phase 3 submission boundary enforcement"
  - "ProgramRole and IProgramMembership types on Express Request"
affects: [03-requests, 05-n8n-notifications, 08-client-collaboration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["authorizeProgram middleware pattern for program-scoped access control", "access-scoped query filtering by user membership", "$and/$or query composition for combined access + search filters"]

key-files:
  created:
    - server/src/middleware/authorizeProgram.ts
  modified:
    - server/src/modules/program/program.service.ts
    - server/src/modules/program/program.controller.ts
    - server/src/modules/program/program.routes.ts
    - server/src/modules/program/program.schema.ts
    - server/src/modules/user/programMember.model.ts
    - server/src/shared/types.ts

key-decisions:
  - "authorizeProgram middleware factory with optional roles array for fine-grained program-level permission checks"
  - "Access-scoped listing: managers see memberships + created programs, team_member/client see only memberships"
  - "Cache keys include userId for non-admin program list queries to prevent cross-user cache leakage"
  - "Router-level authorize removed; per-route middleware applied for flexible authorization layering"

patterns-established:
  - "authorizeProgram middleware: admin bypass, ProgramMember lookup, optional role check, req.programMembership attachment"
  - "Access-scoped service functions: accept userId + userRole params, filter at query level not controller level"
  - "Three-layer route authorization: authenticate -> authorize (global role) -> authorizeProgram (program-scoped)"

requirements-completed: [PROG-03, PROG-06]

# Metrics
duration: 17min
completed: 2026-02-20
---

# Phase 2 Plan 2: Program Access Scoping and Member Management Summary

**authorizeProgram middleware with ProgramMember-based access control, access-scoped program listing preventing data leakage, and member CRUD endpoints**

## Performance

- **Duration:** 17 min
- **Started:** 2026-02-20T13:55:45Z
- **Completed:** 2026-02-20T14:12:46Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- authorizeProgram middleware that checks ProgramMember collection for non-admin users, with admin bypass and optional role filtering
- Access-scoped program listing: non-admin users see ONLY programs they are members of (PROG-06 enforced, no program name leakage)
- Program member management endpoints: add member (POST 201), remove member (DELETE 204), list members (GET 200 paginated)
- checkProgramTimeframe utility ready for Phase 3 to enforce submission boundaries (archived, not started, ended)
- Route restructuring: removed router-level authorize, applied per-route authorization with three-layer middleware pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: authorizeProgram middleware and program member management** - `fcd9761` (feat)
2. **Task 2: Access-scoped program listing and boundary enforcement** - `99c1424` (feat)

## Files Created/Modified
- `server/src/middleware/authorizeProgram.ts` - Program-scoped authorization middleware with admin bypass, ProgramMember lookup, optional role check
- `server/src/modules/program/program.service.ts` - Added access-scoped getPrograms, checkProgramTimeframe, addMember, removeMember, getMembers
- `server/src/modules/program/program.controller.ts` - Added member management controllers, updated getPrograms to pass userId/userRole
- `server/src/modules/program/program.routes.ts` - Restructured routes with per-route authorization, added member management endpoints
- `server/src/modules/program/program.schema.ts` - Added addMemberSchema and listMembersQuerySchema Zod validation
- `server/src/modules/user/programMember.model.ts` - Added ref: 'Program' to programId field (Program model now exists)
- `server/src/shared/types.ts` - Added ProgramRole, IProgramMembership types; augmented Express Request with programMembership

## Decisions Made
- authorizeProgram middleware uses a factory pattern with optional `{ roles: ProgramRole[] }` for fine-grained control -- same pattern as the existing authorize middleware
- Access-scoped listing: managers see their memberships PLUS programs they created (createdBy), while team_member/client see only memberships -- this balances usability with security
- Cache keys for non-admin list queries include userId to prevent serving another user's access-scoped results from cache
- Removed router-level `router.use(authorize('admin', 'manager'))` so that GET /programs is accessible to all authenticated users -- access filtering happens in the service layer instead

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type for req.params.programId in authorizeProgram**
- **Found during:** Task 1
- **Issue:** `req.params.programId` type is `string | string[]` in Express, causing TS2345 when passing to `mongoose.Types.ObjectId.isValid()`
- **Fix:** Cast to `string | undefined` and added explicit `typeof programId !== 'string'` check
- **Files modified:** server/src/middleware/authorizeProgram.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** fcd9761 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type fix necessary for TypeScript strict mode. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Program access control is fully functional: authorizeProgram middleware protects all program-specific routes
- Non-admin users see only their programs (PROG-06 security requirement met)
- Member management endpoints enable adding/removing users to programs with proper roles
- checkProgramTimeframe utility is ready for Phase 3 (Request module) to enforce submission boundaries
- All program routes follow three-layer authorization: authenticate -> authorize (global) -> authorizeProgram (scoped)

## Self-Check: PASSED

All 7 source files verified present. SUMMARY.md verified present. Both task commits (fcd9761, 99c1424) verified in git log.

---
*Phase: 02-programs-dynamic-fields*
*Completed: 2026-02-20*
