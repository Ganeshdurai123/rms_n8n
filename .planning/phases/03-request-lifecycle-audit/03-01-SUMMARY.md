---
phase: 03-request-lifecycle-audit
plan: 01
subsystem: database
tags: [mongoose, zod, state-machine, audit-log, request-lifecycle]

# Dependency graph
requires:
  - phase: 02-programs-dynamic-fields
    provides: "Program model with fieldDefinitions for dynamic field references"
  - phase: 01-foundation-authentication
    provides: "User model, Role type, logger, error classes"
provides:
  - "Request Mongoose model with dynamic fields Map and status enum"
  - "Comment Mongoose model for request activity tracking"
  - "Attachment Mongoose model with file metadata and MIME type constants"
  - "AuditLog Mongoose model for mutation tracking with before/after snapshots"
  - "Zod validation schemas for request CRUD, transitions, assignment, and listing"
  - "State machine with VALID_TRANSITIONS map and role-based canUserTransition"
  - "Fire-and-forget createAuditEntry utility for all mutation operations"
  - "Audit log query schema with date range and multi-field filtering"
affects: [03-request-lifecycle-audit, 04-real-time-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [state-machine-transition-map, fire-and-forget-audit, dynamic-fields-map]

key-files:
  created:
    - server/src/modules/request/request.model.ts
    - server/src/modules/request/comment.model.ts
    - server/src/modules/request/attachment.model.ts
    - server/src/modules/audit/auditLog.model.ts
    - server/src/modules/request/request.schema.ts
    - server/src/modules/request/stateMachine.ts
    - server/src/modules/audit/audit.schema.ts
    - server/src/modules/audit/audit.utils.ts
  modified: []

key-decisions:
  - "Dynamic fields stored as Mongoose Map<string, unknown> -- validated at service layer against program fieldDefinitions"
  - "State machine uses Record<RequestStatus, RequestStatus[]> for transition map with string-key role authorization"
  - "Audit utility returns null on failure (fire-and-forget) so audit errors never break main operations"
  - "REQUEST_STATUSES and AUDIT_ACTIONS exported as const arrays for reuse across schemas and models"

patterns-established:
  - "State machine pattern: VALID_TRANSITIONS map + canTransition/canUserTransition functions"
  - "Fire-and-forget audit: createAuditEntry catches errors and logs without throwing"
  - "Request module structure: model + schema + stateMachine as separate files in modules/request/"
  - "Audit module structure: model + schema + utils as separate files in modules/audit/"

requirements-completed: [REQ-01, REQ-02, REQ-05, REQ-09, AUDIT-01]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 3 Plan 01: Request Lifecycle Data Foundation Summary

**Mongoose models for Request/Comment/Attachment/AuditLog with Zod schemas, state machine transition map, and fire-and-forget audit utility**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T17:27:35Z
- **Completed:** 2026-02-20T17:29:59Z
- **Tasks:** 2
- **Files created:** 8

## Accomplishments
- 4 Mongoose models (Request, Comment, Attachment, AuditLog) with typed interfaces, validation, and compound indexes
- Zod validation schemas for all request CRUD operations, transitions, assignment, and audit log queries
- State machine encoding 7 valid transitions with role-based authorization for the complete request lifecycle
- Reusable fire-and-forget audit utility ready for every mutation operation in Plans 02 and 03

## Task Commits

Each task was committed atomically:

1. **Task 1: Request, Comment, Attachment, and AuditLog Mongoose models** - `b7d6959` (feat)
2. **Task 2: Zod schemas, state machine, and audit utility** - `00bef75` (feat)

## Files Created/Modified
- `server/src/modules/request/request.model.ts` - Request model with dynamic fields Map, status enum, priority, indexes
- `server/src/modules/request/comment.model.ts` - Comment model linked to requests for activity tracking
- `server/src/modules/request/attachment.model.ts` - Attachment model with ALLOWED_MIME_TYPES and MAX_FILE_SIZE
- `server/src/modules/audit/auditLog.model.ts` - AuditLog model with action enum, entity tracking, before/after snapshots
- `server/src/modules/request/request.schema.ts` - Zod schemas for create, update, transition, assign, list, params
- `server/src/modules/request/stateMachine.ts` - VALID_TRANSITIONS, TRANSITION_ROLES, canTransition, canUserTransition
- `server/src/modules/audit/audit.schema.ts` - Audit log query schema with date range and multi-field filtering
- `server/src/modules/audit/audit.utils.ts` - createAuditEntry fire-and-forget utility

## Decisions Made
- Dynamic fields stored as Mongoose Map<string, unknown> with validation deferred to service layer against program fieldDefinitions (not in Zod, since schemas are dynamic and program-specific)
- State machine uses string-key format ("from->to") for TRANSITION_ROLES mapping -- simple, readable, O(1) lookup
- Audit utility returns null on failure rather than throwing -- audit writes must never break the main operation (fire-and-forget per project philosophy)
- REQUEST_STATUSES and AUDIT_ACTIONS exported as const arrays enabling type-safe enum reuse across both Mongoose schemas and Zod schemas

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 8 data layer files ready for Plan 02 (Request CRUD + state transitions) and Plan 03 (Comments, attachments, audit views)
- State machine and audit utility can be imported directly by service/controller layers
- Request model's programId ref enables access-scoping via existing authorizeProgram middleware from Phase 2

## Self-Check: PASSED

- All 8 source files: FOUND
- SUMMARY.md: FOUND
- Commit b7d6959 (Task 1): FOUND
- Commit 00bef75 (Task 2): FOUND

---
*Phase: 03-request-lifecycle-audit*
*Completed: 2026-02-20*
