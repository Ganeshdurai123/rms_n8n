# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Internal teams and clients can submit, track, and manage requests through configurable programs with full lifecycle visibility
**Current focus:** Phase 3 - Request Lifecycle + Audit (COMPLETE)

## Current Position

Phase: 3 of 8 (Request Lifecycle + Audit)
Plan: 3 of 3 in current phase (03-03 complete -- PHASE COMPLETE)
Status: Phase Complete
Last activity: 2026-02-20 -- Completed 03-03-PLAN.md (Comments, Attachments, Request Detail, Audit Views)

Progress: [████░░░░░░] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 8min
- Total execution time: 1.24 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-authentication | 4 | 29min | 7.3min |
| 02-programs-dynamic-fields | 2 | 21min | 10.5min |
| 03-request-lifecycle-audit | 3 | 24min | 8min |

**Recent Trend:**
- Last 5 plans: 02-02 (17min), 03-01 (2min), 03-02 (3min), 03-03 (19min)
- Trend: stable

*Updated after each plan completion*
| Phase 03 P03 | 19min | 3 tasks | 16 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 8-phase structure derived from 12 requirement categories with dependency ordering
- Roadmap: n8n integration and notifications combined into single phase (Phase 5) since email notifications require n8n workflows
- Roadmap: Sheet views and request books are separate phases (6 and 7) despite both depending on Phase 3 -- they are distinct user workflows
- Roadmap: Client collaboration is the final phase (8) because it requires programs, requests, real-time, and notifications to all be working
- 01-01: Used tsx watch for dev hot-reload (faster, ESM-compatible, zero-config per STACK.md)
- 01-01: Separate JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in env validation (per PITFALLS.md)
- 01-01: CORS origin set to validated env.CLIENT_URL for cookie-based auth (not wildcard)
- 01-01: Nginx /api/v1/internal/ block before /api/ rule (per PITFALLS.md Pitfall 2)
- 01-02: Used nanoid@3 (CJS) instead of nanoid@5 (ESM-only) for NodeNext module compatibility
- 01-02: Logout does NOT require authenticate middleware -- identity from refresh token cookie so expired-access-token users can log out
- 01-02: Refresh token bcrypt rounds 10 (vs 12 for passwords) since tokens are already high-entropy
- 01-02: Auth routes mounted directly on app, not apiRouter, for clean /api/v1/auth path
- 01-03: authorize middleware is centralized factory -- no inline role checks anywhere (per PITFALLS.md Pitfall 4)
- 01-03: ProgramMember is separate collection with compound unique index (userId+programId), not embedded
- 01-03: Deactivation is soft delete + all refresh token revocation for immediate session termination
- 01-03: Router-level middleware for authenticate+authorize on all user routes rather than per-route
- 01-04: Used import.meta.url + fileURLToPath instead of __dirname in vite.config.ts (ESM compatibility)
- 01-04: Added @types/node for Node.js path module resolution in Vite config TypeScript
- 02-01: Embedded subdocuments for fieldDefinitions (not separate collection) per ARCHITECTURE.md Pattern 2
- 02-01: escapeRegex utility for safe case-insensitive name uniqueness checks in RegExp constructor
- 02-01: Suppressed Mongoose auto _id on fieldDefinition subdocuments -- key field serves as identifier
- 02-01: Redis caching with CACHE_TTL_CONFIG for single program reads and CACHE_TTL_LIST for list queries
- 02-02: authorizeProgram middleware factory with optional roles array for fine-grained program-level permission checks
- 02-02: Access-scoped listing: managers see memberships + created programs, team_member/client see only memberships
- 02-02: Cache keys include userId for non-admin program list queries to prevent cross-user cache leakage
- 02-02: Router-level authorize removed; per-route middleware applied for flexible authorization layering
- 03-01: Dynamic fields stored as Mongoose Map<string, unknown> -- validated at service layer against program fieldDefinitions
- 03-01: State machine uses Record<RequestStatus, RequestStatus[]> for transition map with string-key role authorization
- 03-01: Audit utility returns null on failure (fire-and-forget) so audit errors never break main operations
- 03-01: REQUEST_STATUSES and AUDIT_ACTIONS exported as const arrays for reuse across schemas and models
- 03-02: Dynamic field validation via validateFields helper in service layer -- checks required, type, dropdown options, rejects unknown keys
- 03-02: Access scoping in getRequests: clients see createdBy:userId, team_members see createdBy OR assignedTo, admin/manager see all
- 03-02: Creator-only submit rule: draft->submitted and rejected->submitted require request.createdBy === userId
- 03-02: Assignment restricted to active program members with team_member or manager role via ProgramMember lookup
- 03-03: Comment timeline uses createdAt ascending (oldest first) for natural conversation flow
- 03-03: Attachment filenames use nanoid + timestamp to guarantee uniqueness on disk
- 03-03: Request detail runs 4 parallel queries via Promise.all for optimal aggregation performance
- 03-03: Admin audit log mounted at /api/v1/admin/audit -- separate admin namespace
- 03-03: Per-request audit trail at /:requestId/audit accessible to any program member (not admin-only)
- 03-03: Sub-resource routing pattern: commentRouter/attachmentRouter mounted via mergeParams

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag: Package versions in STACK.md are from training data (May 2025 cutoff) -- verify with npm before locking package.json in Phase 1
- Research flag: n8n workflow JSON schema and MongoDB connector behavior need live verification during Phase 5
- Research flag: Request book import wizard UI has no canonical pattern -- may need UX research during Phase 7 planning

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 03-03-PLAN.md (Comments, Attachments, Request Detail, Audit Views) -- Phase 3 COMPLETE
Resume file: None
