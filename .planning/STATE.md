# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Internal teams and clients can submit, track, and manage requests through configurable programs with full lifecycle visibility
**Current focus:** Phase 2 - Programs + Dynamic Fields (COMPLETE)

## Current Position

Phase: 2 of 8 (Programs + Dynamic Fields)
Plan: 2 of 2 in current phase (02-02 complete -- phase complete)
Status: Phase Complete
Last activity: 2026-02-20 -- Completed 02-02-PLAN.md (Program access scoping and member management)

Progress: [██░░░░░░░░] 23%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 8.3min
- Total execution time: 0.83 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-authentication | 4 | 29min | 7.3min |
| 02-programs-dynamic-fields | 2 | 21min | 10.5min |

**Recent Trend:**
- Last 5 plans: 01-03 (11min), 01-04 (3min), 02-01 (4min), 02-02 (17min)
- Trend: stable

*Updated after each plan completion*

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

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag: Package versions in STACK.md are from training data (May 2025 cutoff) -- verify with npm before locking package.json in Phase 1
- Research flag: n8n workflow JSON schema and MongoDB connector behavior need live verification during Phase 5
- Research flag: Request book import wizard UI has no canonical pattern -- may need UX research during Phase 7 planning

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 02-02-PLAN.md (Program access scoping and member management) -- Phase 2 complete
Resume file: None
