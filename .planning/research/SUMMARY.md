# Project Research Summary

**Project:** Request Management System with n8n Automation
**Domain:** Internal operations + client collaboration request tracking with self-hosted automation
**Researched:** 2026-02-20
**Confidence:** MEDIUM

## Executive Summary

This is an internal request management system (RMS) with a client-facing collaboration layer, differentiated by n8n-powered automation replacing all background job infrastructure. The product competes in the space occupied by Jira Service Management, Freshservice, and Monday.com, but targets teams that want full infrastructure ownership, unlimited automation without per-seat pricing, and a first-class bulk import story for teams migrating from spreadsheets. The recommended approach is a modular monolith: a single Express process backed by MongoDB and Socket.IO, with n8n acting as an async processing sidecar invoked via fire-and-forget webhooks. The frontend is a React SPA with dynamic, program-driven form and table rendering. All email, scheduled reminders, escalations, and report generation run through n8n — never in the Express process.

The most important architectural decision is the dynamic field system. Each program defines its own field schema; requests store values as a typed array-of-key-value pairs directly embedded in the document (not EAV, not a flat object map). This pattern supports indexed querying on dynamic fields, which is required once programs grow beyond a few hundred requests. The second most important decision is establishing centralized RBAC and the webhook outbox from day one — both pitfalls are prohibitively expensive to retrofit and affect every other phase if deferred.

The key risks are: (1) webhook delivery loss if n8n restarts during a burst of mutations — mitigated by a MongoDB outbox with a sweep workflow; (2) client data leakage through Mongoose populate calls and Socket.IO rooms if query scoping is not enforced at the service layer; (3) dynamic field query performance collapse if the schema uses a plain object map instead of an indexable array. All three risks must be addressed in Phase 1 or Phase 2 — they cannot be left for later phases.

---

## Key Findings

### Recommended Stack

The stack centers on React 18 + Vite 6 + TypeScript + shadcn/ui on the frontend, and Node 20 LTS + Express 4 + Mongoose 8 + MongoDB 7 on the backend. Socket.IO 4 handles real-time updates, Redis 7 handles caching and rate limiting only (no queues — n8n owns all async work), and n8n (self-hosted Docker) handles automation. Seven Docker Compose containers cover all services: nginx, Express, React build, MongoDB, Redis, PostgreSQL (n8n only), and n8n. Do not add more.

Version discipline is critical: stay on React 18, Tailwind CSS v3, Express 4, and Zod 3 — do not jump to React 19, Tailwind v4, Express 5, or Zod 4 until ecosystem compatibility is verified. All version numbers come from training data (cutoff May 2025) and must be verified against `npm view <pkg> version` before locking `package.json`.

**Core technologies:**
- React 18.3 + Vite 6 + shadcn/ui: UI layer — stable ecosystem, component ownership model avoids version lock-in
- Express 4.21 + TypeScript 5.6: API server — mature, middleware-rich, do not upgrade to Express 5 (RC only)
- MongoDB 7.0 + Mongoose 8.9: Primary datastore — compound wildcard indexes support dynamic field querying
- Redis 7.2 (cache only): Session blacklist, rate limiting counters, Socket.IO adapter — not a job queue
- Socket.IO 4.8: Real-time events scoped to program rooms — must match client major version
- n8n (self-hosted): Replaces BullMQ, node-cron, and nodemailer entirely — all async work lives here
- TanStack Query v5: All API calls with caching and optimistic updates
- TanStack Table v8: Dynamic column rendering for program-driven sheet views
- react-hook-form + Zod: Form validation with shared schemas across frontend and backend
- Mongoose dynamic validation: Runtime Zod schema built from program's fieldDefinitions at request create/update time

See `.planning/research/STACK.md` for full library list, version compatibility matrix, and installation commands.

### Expected Features

The MVP (v1) must replace a spreadsheet-and-email workflow. Every feature listed below is required at launch — none are nice-to-have.

**Must have (table stakes):**
- Auth + RBAC (4 roles: admin, manager, team_member, client) — without this nothing is usable
- Program CRUD with dynamic field configuration — the organizational backbone, defines everything
- Sheet views (tabular CRUD) with search and filtering — the primary daily interface
- Request full lifecycle: draft → submitted → in_review → approved/rejected → completed
- Request comments, file attachments, activity history — replaces email threads
- n8n webhook integration (fire-and-forget pattern) — foundation for all automation
- Email notifications via n8n — users cannot live in the app 24/7
- In-app notifications via Socket.IO — real-time awareness when in the app
- Client collaboration (restricted views, same SPA) — external client use is a core use case
- Request books (CSV/Excel bulk import with field mapping) — the migration and adoption story
- CSV export of sheet views — demanded from day one by every team
- Audit trail on every mutation — operational trust and compliance

**Should have (competitive differentiators):**
- n8n-powered visible and editable automation workflows — the strongest differentiator vs competitors
- Request Books with field mapping UI and error reporting — significantly underserved by competitors
- Real-time Socket.IO rooms per program — live updates most competitors lack
- n8n scheduled reminders and SLA escalations — configurable without code changes

**Defer to v2+:**
- Due dates with configurable rules per program
- Calendar view (requires due dates)
- Async report generation via n8n (PDF/CSV reports)
- Dashboard (personal overview: my requests, my approvals)
- Kanban/board view — table view is the natural fit; add only if users request it
- SSO (SAML/OIDC) — add only if enterprise customers require it

See `.planning/research/FEATURES.md` for full feature dependency graph, MVP definition, and competitor analysis.

### Architecture Approach

The system is a modular monolith with n8n as a webhook sidecar. Express handles all HTTP and WebSocket traffic synchronously. All async operations (email, reminders, report generation, status callbacks) are delegated to n8n via fire-and-forget POST requests and are never awaited in the request path. n8n calls back into Express via a dedicated `/api/v1/internal/` namespace protected by a shared secret, never by JWT. Socket.IO uses program-scoped rooms — clients join only programs they have membership for, and events are never broadcast globally.

**Major components:**
1. Nginx — reverse proxy, SSL termination, static file serving, blocks `/internal/` from external traffic
2. Express Server (modular monolith, 10 modules) — auth, users, programs, sheets, requests, comments, files, notifications, audit-logs, request-books
3. Socket.IO (same Express process) — real-time events, room-per-program, joined at handshake based on memberships
4. n8n (sidecar) — email, reminders, escalations, report generation, all scheduled tasks
5. MongoDB (Mongoose) — primary datastore, embedded dynamic fields as array-of-KV on Request documents
6. Redis — cache, rate limiting, Socket.IO Redis adapter for future horizontal scaling
7. React SPA — feature-folder structure mirroring backend modules, TanStack Query for all data fetching

**Key patterns to implement:**
- Thin controllers, fat services — services are callable from both HTTP controllers and internal API handlers
- Centralized permission module (`canAccessProgram`, `canManageRequest`, etc.) — no inline role checks in route handlers
- Webhook event catalog as typed contract — Express and n8n share event names and payload shapes
- Dynamic Zod schema construction — built at runtime from program's `fieldDefinitions` for request validation
- Response serialization per role — raw Mongoose documents never sent to clients; separate DTOs for admin vs client

See `.planning/research/ARCHITECTURE.md` for full build order, data flow diagrams, API route map, and anti-patterns.

### Critical Pitfalls

1. **Fire-and-forget webhook loss (n8n downtime)** — Implement a MongoDB `webhook_outbox` collection from day one. Write events there before firing. An n8n sweep workflow polls every 5 minutes and processes pending entries. After 5 failed attempts, mark as `dead_letter` and notify admin. Do NOT skip this — retrofitting costs a full day and lost notifications cannot be recovered.

2. **Unindexed dynamic field storage** — Store `customFields` on Request as `[{ fieldId, key, value, type }]` (array-of-KV), not `{ fieldId: value }` (plain object). Create compound index `{ programId: 1, "customFields.fieldId": 1, "customFields.value": 1 }`. The plain-object pattern is completely unindexable. Migration from plain object to array-of-KV requires rewriting every request document — do it right in Phase 2.

3. **Inline RBAC checks scattered across handlers** — Build a centralized `permissions.ts` module and Express middleware before writing any protected route. Write the role-permission matrix document first. Retrofitting centralized RBAC onto scattered inline checks across 40+ route handlers is a 3-5 day rewrite.

4. **JWT refresh token vulnerabilities** — Refresh tokens must be in HttpOnly, Secure, SameSite=Strict cookies (never localStorage). Implement token family tracking with reuse detection. Store refresh tokens server-side in MongoDB with `tokenFamily`, hashed token, and `isRevoked`. Logout must revoke server-side. This cannot be retrofitted without invalidating all user sessions.

5. **Client data leakage through populate and Socket.IO** — All service-layer queries for client-accessible resources must include a `programId: { $in: allowedProgramIds }` scope parameter that is never optional. Implement role-based response serializers (strip internal fields for client role). Verify with integration tests: a client must get 0 results, not 403, for programs they don't belong to (403 reveals program existence).

---

## Implications for Roadmap

Research strongly indicates a 7-phase build order driven by data dependencies. Each phase depends on the previous being complete before meaningful work can proceed.

### Phase 1: Foundation + Auth + Infrastructure

**Rationale:** Auth is the absolute dependency for every other module. RBAC, webhook outbox, internal API auth pattern, and Docker Compose health checks must all exist before any feature work. These patterns cannot be retrofitted. Pitfalls 3, 4, and the outbox (Pitfall 1) must all be solved here.
**Delivers:** Working Express skeleton, MongoDB + Redis connections, JWT auth with HttpOnly refresh cookies, token family rotation, centralized RBAC middleware and permission module, webhook outbox collection and emitter utility, internal API key auth pattern, Docker Compose with health checks, all 7 services starting cleanly from cold.
**Addresses:** Auth + RBAC, User management, Audit trail infrastructure
**Avoids:** JWT refresh vulnerabilities (Pitfall 4), scattered RBAC (Pitfall 3), webhook delivery loss (Pitfall 1), internal API auth gap (Pitfall 2), Docker startup failures (integration gotcha)
**Research flag:** Standard patterns — established Express/Passport/JWT patterns, no additional research needed.

### Phase 2: Programs + Dynamic Fields

**Rationale:** Programs are the organizational backbone — requests, sheets, client collaboration, and request books all depend on programs existing with their field definitions. The dynamic field schema shape (array-of-KV vs plain object) must be decided and indexed before any requests are created. Pitfall 5 (client data leakage) also begins here — query scoping patterns are established on program queries.
**Delivers:** Program CRUD, program membership model, program-level authorization middleware, dynamic field definition schema on Program (6 types: text, number, date, dropdown, checkbox, file), dynamic Zod schema builder for runtime request validation, query scoping pattern established for all program-scoped queries, response serializers per role.
**Addresses:** Configurable programs, dynamic field configuration, program-level permissions
**Avoids:** Dynamic field query performance collapse (Pitfall 3), client data leakage through populate (Pitfall 5)
**Research flag:** Standard patterns — MongoDB embedded document pattern and Mongoose schema design are well-documented. Dynamic Zod schema construction is a known pattern.

### Phase 3: Request Lifecycle

**Rationale:** Requests are the core value of the system. They require programs and field definitions to exist. Status transitions, comments, file attachments, and audit trail entries all depend on request creation working correctly. This is also the phase where the audit log write pattern is finalized (fire-and-forget, no await).
**Delivers:** Request model with embedded `customFields` (array-of-KV), dynamic field validation against program's definitions, 5-state lifecycle with transition rules (who can transition from which state), request CRUD, status transition endpoint, comment model and CRUD, file upload (local storage + metadata in MongoDB, storage-adapter pattern for later S3 swap), request history from audit log, CSV export of request lists.
**Addresses:** Request CRUD, request lifecycle, comments + attachments, history, CSV export, audit trail
**Avoids:** Audit log performance impact (fire-and-forget writes), EAV anti-pattern in MongoDB
**Research flag:** Standard patterns — request state machine, comment threading, and file upload with multer are well-documented. The dynamic field validation flow (building Zod from program definitions) should be prototyped early and may need phase-level research.

### Phase 4: Real-Time + n8n Integration

**Rationale:** Socket.IO and n8n integration are tightly coupled — the internal socket-emit endpoint must exist before n8n can push real-time events. Socket.IO rooms must be scoped by program membership to avoid the global broadcast anti-pattern. n8n workflows for email and status change notifications can be built once internal endpoints exist.
**Delivers:** Socket.IO server with JWT handshake, room join based on program memberships, program-scoped event emission on every mutation, reconnect-and-refresh client pattern (REST fetch on reconnect, not event replay), webhook emitter firing against outbox, event catalog typed definition, internal socket-emit endpoint, internal notification endpoint, n8n Docker Compose service (with Postgres), n8n workflows: status change emails, assignment emails, new request emails, daily reminder cron, escalation cron. In-app notification model, CRUD, and unread count.
**Addresses:** Email notifications, in-app notifications, real-time updates, n8n webhook integration
**Avoids:** Global Socket.IO broadcasts (use room scoping), Socket.IO reconnection stale state (REST fetch on reconnect), n8n direct MongoDB writes bypassing validation (use internal API for all write callbacks), missing nginx WebSocket upgrade headers
**Research flag:** n8n workflow design needs deeper research during planning. The outbox sweep workflow pattern and n8n's MongoDB connector behavior are less standardized than the Express/Socket.IO patterns.

### Phase 5: Sheet Views + Request Books

**Rationale:** Sheet views are the primary daily interface but depend on the complete request system existing first. Request books (bulk import) require the request creation pipeline to be solid before adding batch insert complexity. Redis caching for list queries belongs here because list performance becomes observable once there is real data.
**Delivers:** Tabular sheet views with dynamic columns driven by program field definitions, column toggle and persistence per user per program, inline row CRUD from sheet view, full-text search and field-level filtering, pagination enforced from day one, Redis caching on list endpoints with pattern-based invalidation, request book import wizard (upload CSV/Excel, parse headers, field mapping UI, validation preview, batch insert in chunks of 100-500), import progress via Socket.IO, downloadable error report with row numbers, formula injection protection on both import (strip) and export (prefix).
**Addresses:** Sheet views, search and filtering, request books (CSV/Excel import), performance at scale
**Avoids:** Fetching all requests without pagination (performance trap), CSV loading entire file into memory (stream with ExcelJS/csv-parse), unindexed sort operations (compound index on programId + createdAt), formula injection (OWASP CSV guidance)
**Research flag:** Request book import UI (field mapping wizard) may need dedicated UX research during planning. The step-by-step import flow (upload → map → preview → import → error report) has no single canonical implementation pattern.

### Phase 6: Client Portal

**Rationale:** Client collaboration is a distinct mode of the same application. It depends on programs, requests, comments, files, and notifications all working correctly for internal users. Client-specific isolation (query scoping, response serialization, Socket.IO room restriction) must be verified with penetration-style integration tests per endpoint.
**Delivers:** Client role restricted views (same SPA, same routes, filtered data), client can only see their assigned programs and their requests, client-accessible comments and file attachments, client Socket.IO room restriction enforced server-side, integration test suite verifying client cannot see other programs' data (not 403, returns empty results), role-based response serializers applied consistently across all endpoints, invite flow via n8n email.
**Addresses:** Client collaboration (restricted portal), client invite flow
**Avoids:** Client data leakage through populate or Socket.IO (Pitfall 5 full verification), room join auth bypass
**Research flag:** Standard patterns — RBAC query scoping and Socket.IO room auth are well-documented. The penetration testing checklist from PITFALLS.md is the spec.

### Phase 7: Reports + v2 Features

**Rationale:** Reports require complete request data to be meaningful and are generated asynchronously by n8n. This phase also covers the v2 features (due dates, calendar, dashboard) that require product-market fit validation before building.
**Delivers:** Async report generation via n8n (trigger webhook, n8n queries MongoDB, generates PDF/Excel, stores result, notifies requester via Socket.IO), report metadata model, report retrieval endpoint, due date field type and configurable rules per program, calendar view, personal dashboard (my requests, my approvals, overdue), n8n escalation workflow for SLA breaches.
**Addresses:** Reports (v2), due dates (v2), calendar view (v2), dashboard (v2)
**Avoids:** Blocking Express on heavy report aggregation (async n8n pattern), Puppeteer for PDF (use pdfkit — lightweight, no headless Chrome)
**Research flag:** pdfkit report templates and n8n aggregation workflow patterns need research during planning. ExcelJS streaming for report output should be prototyped.

### Phase Ordering Rationale

- **Auth before everything:** RBAC, refresh token security, and centralized permission module are foundational constraints. All 7 pitfalls either start in or depend on Phase 1 being done correctly.
- **Programs before requests:** Requests inherit field definitions from programs. The dynamic field schema shape (Pitfall 3) must be finalized on the program before any request documents exist.
- **Request lifecycle before real-time:** Socket.IO and n8n emit events about mutations. Mutations must exist before events can be emitted.
- **Real-time before client portal:** The internal socket-emit endpoint (n8n → Express → Socket.IO) must exist before client-facing notification flows can be tested end-to-end.
- **Sheet views after full request system:** Sheet views are a rendering layer over requests. Building the UI before the API is stable creates thrash.
- **Client portal after internal flows proven:** The same endpoints serve both internal users and clients. Internal correctness is verified before adding the client isolation layer.
- **Reports last:** They require everything else to be running and generating data, and are v2 scope.

### Research Flags

Phases likely needing deeper research during planning (`/gsd:research-phase`):
- **Phase 4 (n8n Integration):** n8n workflow design, outbox sweep pattern, MongoDB connector behavior, and webhook error handling in n8n are less standardized than the Express/Socket.IO patterns. Workflow JSON structures and n8n-specific retry logic need dedicated research.
- **Phase 5 (Request Books):** The multi-step import wizard UI (upload → map → preview → import → error report) has no canonical pattern. UX flow and streaming progress via Socket.IO need research during planning.
- **Phase 7 (Reports):** pdfkit report template design and ExcelJS streaming for large report output need prototyping before committing to an implementation approach.

Phases with standard, well-documented patterns (safe to skip research-phase):
- **Phase 1 (Foundation + Auth):** Express/Passport/JWT/HttpOnly cookie pattern is exhaustively documented.
- **Phase 2 (Programs + Dynamic Fields):** MongoDB embedded document pattern and Mongoose schema design are official-docs-level documentation.
- **Phase 3 (Request Lifecycle):** State machine with transition rules, comment threading, multer file upload — established patterns.
- **Phase 6 (Client Portal):** RBAC query scoping and Socket.IO room auth are well-documented. The penetration checklist from PITFALLS.md serves as the spec.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Architecture-level decisions (Express, MongoDB, n8n, Socket.IO) are HIGH confidence. Specific version numbers are LOW-MEDIUM — verified against training data only (cutoff May 2025), not against live npm registry. Run `npm view <pkg> version` before locking package.json. |
| Features | MEDIUM | Feature set derived from PROJECT.md (HIGH) and competitor analysis (MEDIUM, not live-verified). The MVP scope is well-defined. v2 features are directional only. |
| Architecture | HIGH | Modular monolith + n8n sidecar + Socket.IO rooms are established patterns with official documentation. The embedded dynamic field pattern is MongoDB-idiomatic and well-documented. RBAC middleware composition is a common Express pattern. |
| Pitfalls | MEDIUM-HIGH | JWT, MongoDB indexing, Docker Compose startup, CSV injection, and outbox patterns are from official or OWASP-level sources. n8n-specific failure modes (outbox sweep workflow, n8n execution monitoring) are MEDIUM confidence — less standardized. |

**Overall confidence:** MEDIUM-HIGH

The architectural approach and feature scope are clear and well-supported. Version numbers and n8n-specific patterns carry the most uncertainty and should be validated during Phase 1 and Phase 4 implementation.

### Gaps to Address

- **Package version verification:** All versions in STACK.md are training-data-based. Verify every core package with `npm view <pkg> version` before `package.json` is locked. Pay special attention to: React (19 may be production-stable by now), Vite 6 ecosystem compatibility, TanStack Query v5 and Table v8 peer deps.

- **n8n workflow JSON schema:** The specific JSON structure for n8n workflow exports, webhook node configuration, and MongoDB connector configuration needs live verification against the installed n8n version. This cannot be inferred from training data alone — workflow schemas change between n8n minor versions.

- **File storage strategy:** The STACK.md and ARCHITECTURE.md both recommend local filesystem for Phase 1 with a storage-adapter pattern for S3 migration. The exact adapter interface and how it integrates with multer needs to be designed before Phase 3. If the deployment environment already has S3-compatible storage (MinIO, AWS S3), consider starting there.

- **Dynamic Zod schema construction benchmark:** Building a Zod schema at runtime from `fieldDefinitions` on every request validation adds latency. This needs a quick benchmark during Phase 2 to determine if program field definitions should be cached in Redis (keyed by `programId`, invalidated on field definition change).

- **n8n PostgreSQL sizing:** The PostgreSQL 16 instance for n8n metadata only needs modest resources, but n8n stores full execution logs in Postgres. Without pruning, the Postgres volume grows unboundedly. Establish a retention policy (e.g., prune executions older than 30 days) before the n8n service is in production.

---

## Sources

### Primary (HIGH confidence)
- `.planning/research/ARCHITECTURE.md` — Express middleware patterns, Socket.IO rooms, MongoDB embedded document schema, n8n webhook sidecar pattern (established official-documentation-backed patterns)
- MongoDB documentation — embedded documents, Map types, wildcard indexes (referenced in ARCHITECTURE.md and STACK.md)
- Socket.IO official documentation — connection lifecycle, rooms, Redis adapter (referenced in ARCHITECTURE.md)
- OWASP Authentication Cheat Sheet / Auth0 docs — JWT refresh token rotation, token family pattern (referenced in PITFALLS.md)
- OWASP CSV Injection prevention — formula injection prevention on export/import (referenced in PITFALLS.md)
- Docker official docs — `depends_on` with `condition: service_healthy` (referenced in PITFALLS.md)

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` — library recommendations, version compatibility matrix, n8n integration patterns (training data, May 2025 cutoff)
- `.planning/research/FEATURES.md` — feature analysis, competitor comparison (domain expertise + training data)
- `.planning/research/PITFALLS.md` — n8n-specific failure modes, outbox pattern for webhook reliability (MEDIUM — n8n community patterns, less standardized)
- Jira Service Management, Freshservice, Monday.com, ServiceNow feature sets — competitor analysis basis in FEATURES.md (training data, may have changed)

### Tertiary (LOW confidence — verify before implementation)
- Specific npm package versions in STACK.md — all based on training data cutoff May 2025; must be verified with `npm view <pkg> version`
- React 19 compatibility with shadcn/ui, react-hook-form, react-router-dom — STACK.md recommends staying on React 18; verify if 19 is now stable and compatible
- n8n workflow export JSON schema — exact structure changes between n8n versions; verify against installed version

---
*Research completed: 2026-02-20*
*Ready for roadmap: yes*
