---
phase: 10-sequential-request-chains
plan: 01
subsystem: api
tags: [mongoose, express, chain, auto-transition, socket.io, audit]

# Dependency graph
requires:
  - phase: 03-request-lifecycle-audit
    provides: "Request model, status transitions, audit logging, request detail aggregation"
  - phase: 04-real-time-events
    provides: "Socket.IO emitToProgram, webhook enqueue, real-time event infrastructure"
provides:
  - "RequestChain Mongoose model with name, programId, steps (requestId + sequence), status"
  - "Chain CRUD API: POST/GET/GET:id at /programs/:programId/chains"
  - "Auto-transition logic: handleChainProgression advances chain when request completes"
  - "Chain context in request detail API for frontend chain visualization"
  - "chainId/chainSequence fields on Request model for chain membership tracking"
  - "chain:step_advanced socket event for real-time chain progression updates"
affects: [10-sequential-request-chains]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Chain auto-transition via fire-and-forget handleChainProgression on status=completed"]

key-files:
  created:
    - server/src/modules/chain/chain.model.ts
    - server/src/modules/chain/chain.schema.ts
    - server/src/modules/chain/chain.service.ts
    - server/src/modules/chain/chain.controller.ts
    - server/src/modules/chain/chain.routes.ts
  modified:
    - server/src/modules/request/request.model.ts
    - server/src/modules/request/request.service.ts
    - server/src/modules/request/request.schema.ts
    - server/src/modules/request/requestDetail.service.ts
    - server/src/modules/audit/auditLog.model.ts
    - server/src/shared/socketEvents.ts
    - server/src/app.ts

key-decisions:
  - "getPerformerName duplicated in chain.service.ts to avoid circular imports (consistent with request.service.ts pattern)"
  - "Steps sorted by sequence in createChain for consistent ordering regardless of input order"
  - "Chain creation auto-submits first step (sequence=1) from draft to submitted with audit trail"
  - "handleChainProgression only advances from draft status -- if next step was already transitioned, it's a no-op for safety"
  - "Chain routes restricted to manager role via authorizeProgram({ roles: ['manager'] }) -- admin bypasses automatically"

patterns-established:
  - "Chain auto-transition: fire-and-forget handleChainProgression called after status->completed"
  - "Chain context: getChainByRequestId returns populated chain or null for request detail enrichment"
  - "chainId populated with name in list queries for display without extra lookups"

requirements-completed: [CHAIN-01, CHAIN-02]

# Metrics
duration: 6min
completed: 2026-02-23
---

# Phase 10 Plan 01: Sequential Request Chains Backend Summary

**RequestChain model, CRUD API, and auto-transition logic that advances chains when requests complete**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-23T10:15:04Z
- **Completed:** 2026-02-23T10:21:03Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- RequestChain Mongoose model with name, programId, ordered steps array, status, and createdBy
- Full CRUD API (create, list, get) mounted at /programs/:programId/chains with manager-only access
- Auto-transition logic: when a chained request completes, the next step auto-submits from draft to submitted
- Chain context integrated into request detail API (5th parallel query) and request list populates chainId with name

## Task Commits

Each task was committed atomically:

1. **Task 1: RequestChain model, Zod schemas, and CRUD service/controller/routes** - `c46decb` (feat)
2. **Task 2: Wire auto-transition into transitionRequest, populate chainId in list queries, and add chain context to request detail** - `51a7bb9` (feat)

## Files Created/Modified
- `server/src/modules/chain/chain.model.ts` - RequestChain Mongoose model with steps subdocuments
- `server/src/modules/chain/chain.schema.ts` - Zod schemas for create, params, and list queries
- `server/src/modules/chain/chain.service.ts` - CRUD + handleChainProgression auto-transition logic
- `server/src/modules/chain/chain.controller.ts` - Express controller with create, list, getById handlers
- `server/src/modules/chain/chain.routes.ts` - Routes with authenticate + authorizeProgram manager-only
- `server/src/modules/request/request.model.ts` - Added chainId and chainSequence fields with compound index
- `server/src/modules/request/request.service.ts` - Chain progression call on completed, chainId populate and filter
- `server/src/modules/request/request.schema.ts` - Added chainId filter and chainSequence sortBy option
- `server/src/modules/request/requestDetail.service.ts` - 5th parallel query for chain context
- `server/src/modules/audit/auditLog.model.ts` - Added chain.created, chain.step_auto_submitted actions and chain entity type
- `server/src/shared/socketEvents.ts` - Added chain:step_advanced event type
- `server/src/app.ts` - Mounted chainRouter at /programs/:programId/chains

## Decisions Made
- getPerformerName duplicated in chain.service.ts to avoid circular imports (consistent with request.service.ts pattern from 04-02)
- Steps sorted by sequence in createChain for consistent ordering regardless of input order
- Chain creation auto-submits first step (sequence=1) from draft to submitted with full audit trail
- handleChainProgression only advances from draft status -- if next step was already transitioned, it's a no-op for safety
- Chain routes restricted to manager role via authorizeProgram({ roles: ['manager'] }) -- admin bypasses automatically
- Suppress auto _id on step subdocuments (requestId serves as identifier, same pattern as fieldDefinitions in program.model.ts)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Chain backend complete, ready for frontend chain management UI (Plan 10-02)
- Chain CRUD endpoints available for testing
- Auto-transition wiring fully integrated into existing request lifecycle

## Self-Check: PASSED

- All 5 created files verified present on disk
- Commit c46decb (Task 1) verified in git log
- Commit 51a7bb9 (Task 2) verified in git log
- TypeScript compilation: zero errors

---
*Phase: 10-sequential-request-chains*
*Completed: 2026-02-23*
