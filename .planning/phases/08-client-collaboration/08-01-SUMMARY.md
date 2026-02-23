---
phase: 08-client-collaboration
plan: 01
subsystem: api
tags: [authorization, ownership, client-role, forbidden, middleware]

# Dependency graph
requires:
  - phase: 03-request-lifecycle-audit
    provides: "Request CRUD, comments, attachments, audit trail, state machine"
  - phase: 02-programs-dynamic-fields
    provides: "authorizeProgram middleware, ProgramMember model"
provides:
  - "Client ownership enforcement on getRequestById and getRequestDetail"
  - "Client-only delete checks on comments and attachments"
  - "Import routes restricted to manager+ roles"
affects: [08-client-collaboration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Client ownership check pattern: if userRole === 'client' && createdBy !== userId throw ForbiddenError"]

key-files:
  created: []
  modified:
    - server/src/modules/request/request.service.ts
    - server/src/modules/request/requestDetail.service.ts
    - server/src/modules/request/request.controller.ts
    - server/src/modules/request/comment.service.ts
    - server/src/modules/request/attachment.service.ts
    - server/src/modules/request/request.routes.ts

key-decisions:
  - "Client ownership checks placed after DB fetch (not query filter) to return 403 instead of 404 for unauthorized access"
  - "getRequestById ownership check applied to both cached and DB-fetched results to prevent cache bypass"
  - "Explicit client checks added before existing isAuthor/isPrivileged logic in comment and attachment services for clarity"
  - "Import routes restricted via authorizeProgram({ roles: ['manager'] }) -- admin bypasses automatically"
  - "createRequest confirmed unrestricted for client role -- satisfies CLIENT-02"
  - "deleteRequest already enforced creator-only for non-admin -- no change needed"

patterns-established:
  - "Client ownership pattern: userRole === 'client' check with createdBy/authorId/uploadedBy comparison before ForbiddenError throw"

requirements-completed: [CLIENT-01, CLIENT-02, CLIENT-03, CLIENT-04]

# Metrics
duration: 3min
completed: 2026-02-23
---

# Phase 8 Plan 1: Client Collaboration - Backend API Hardening Summary

**Client ownership enforcement on request detail/get/delete, comment/attachment delete guards, and import route restriction to manager+ roles**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T05:06:57Z
- **Completed:** 2026-02-23T05:09:47Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Client role users get 403 Forbidden when accessing requests they did not create (getById, getDetail)
- Client role users can only delete their own comments and attachments (explicit ownership checks)
- Import routes restricted to manager role (admin bypasses automatically)
- Confirmed createRequest is unrestricted for client role (CLIENT-02 satisfied at API layer)
- Confirmed deleteRequest already enforced creator-only for non-admin (no change needed)
- Confirmed assign route already restricted to manager role (no change needed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add client ownership checks to request detail, single get, and delete** - `55068d3` (feat)
2. **Task 2: Add client guard rails to comments, attachments, and import routes** - `2dc0cc8` (feat)

## Files Created/Modified
- `server/src/modules/request/request.service.ts` - Added userId/userRole params to getRequestById with client ownership enforcement on both cached and DB paths
- `server/src/modules/request/requestDetail.service.ts` - Added userId/userRole params to getRequestDetail with client ownership enforcement after fetch
- `server/src/modules/request/request.controller.ts` - Updated getById and getDetail handlers to pass req.user._id and req.user.role
- `server/src/modules/request/comment.service.ts` - Added explicit client ownership check in deleteComment
- `server/src/modules/request/attachment.service.ts` - Added explicit client ownership check in deleteAttachment
- `server/src/modules/request/request.routes.ts` - Added authorizeProgram({ roles: ['manager'] }) to import route mount

## Decisions Made
- Client ownership checks placed after DB fetch (not query filter) to return 403 instead of 404 for unauthorized access -- prevents information leakage about resource existence
- getRequestById restructured from early-return cache pattern to unified flow so ownership check applies to both cached and DB-fetched results
- Explicit client checks added as first guard in comment/attachment delete functions for readability, even though existing isAuthor/isPrivileged logic already blocks non-author clients
- Import routes restricted via same authorizeProgram middleware pattern used by assign endpoint for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend API fully hardened for client role access control
- Ready for client-facing UI development (08-02, 08-03)
- All existing admin/manager/team_member functionality unaffected

## Self-Check: PASSED

All 6 modified files verified present. Both task commits (55068d3, 2dc0cc8) verified in git log.

---
*Phase: 08-client-collaboration*
*Completed: 2026-02-23*
