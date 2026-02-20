# Pitfalls Research

**Domain:** Request Management System with n8n automation, dynamic fields, RBAC, real-time updates
**Researched:** 2026-02-20
**Confidence:** MEDIUM-HIGH (based on established patterns for each technology; n8n-specific integration patterns are less documented than the other areas)

## Critical Pitfalls

### Pitfall 1: Fire-and-Forget Webhooks With No Delivery Guarantee

**What goes wrong:**
Express fires webhook POSTs to n8n and immediately forgets them. When n8n is down (restarting, OOM, upgrading, Docker health check failing), those webhooks vanish silently. Notifications never send, status callbacks never fire, reports never generate. The main app appears healthy but the automation layer has a black hole.

**Why it happens:**
Fire-and-forget is chosen deliberately to decouple the backend from n8n failures. But developers assume n8n has near-100% uptime and never build any compensation mechanism. They test with n8n always running and never simulate n8n downtime during integration testing.

**How to avoid:**
1. **Outbox pattern:** Write webhook events to a MongoDB `webhook_outbox` collection before firing. Include `status: pending`, `createdAt`, `attempts: 0`, `lastAttemptAt`. Fire the webhook, mark `status: sent` on 2xx response. On failure or timeout, leave as `pending`.
2. **n8n sweep workflow:** Create an n8n workflow that polls the outbox collection every 5 minutes for `pending` records older than 2 minutes. Process them and mark as `sent`. This means n8n self-heals after downtime.
3. **Dead letter threshold:** After 5 failed attempts, mark `status: dead_letter` and emit an admin notification. Do not retry forever.
4. **Startup reconciliation:** When n8n comes back online after a crash, the sweep workflow catches all missed events automatically.

**Warning signs:**
- Clients report "I submitted a request but never got an email"
- Audit logs show mutations but no corresponding n8n activity
- Gap between AuditLog count and notification count grows after n8n restarts
- No monitoring on webhook POST failure rates

**Phase to address:**
Phase 1 (Foundation/Infrastructure). The outbox table and basic retry must exist before any webhook integration is built. Retrofitting an outbox onto an existing fire-and-forget system is painful because every webhook call site needs modification.

---

### Pitfall 2: n8n Callback Authentication and the Internal API Surface

**What goes wrong:**
n8n needs to call back into Express (e.g., POST `/api/v1/internal/socket-emit`) or write directly to MongoDB. Developers either: (a) leave internal endpoints completely unprotected, creating a privilege escalation vector, or (b) use the same JWT auth as regular users, which breaks because n8n is not a "user" and tokens expire. The internal API surface grows organically without access control, and eventually n8n has god-mode access to every endpoint.

**Why it happens:**
n8n is trusted infrastructure, so security is an afterthought. There is no natural "service account" concept in a user-focused JWT system. Developers add `// TODO: secure this` and ship it.

**How to avoid:**
1. **Shared secret / API key auth for internal endpoints:** Generate a long random secret stored in both Express and n8n environment variables. Internal endpoints validate `Authorization: Bearer <internal-api-key>` against this secret. This never expires and is not a JWT.
2. **Separate route namespace:** All n8n-callable endpoints live under `/api/v1/internal/` with a dedicated middleware that only accepts the internal API key. Regular JWT middleware is not applied to this namespace.
3. **Principle of least privilege:** Each internal endpoint does one thing. Do not create a generic "execute any action" internal endpoint. `POST /internal/socket-emit` is fine. `POST /internal/execute` with a body like `{ action: "deleteUser", params: {...} }` is not.
4. **Network-level restriction:** In Docker Compose, the internal endpoints should only be reachable from the Docker network. Use nginx to block `/api/v1/internal/*` from external traffic.

**Warning signs:**
- Internal endpoints accessible from the browser without auth
- n8n using a hardcoded admin JWT that was copy-pasted from a login session
- Internal endpoints accepting arbitrary MongoDB queries or operations
- No nginx rule blocking `/internal/` routes from outside Docker network

**Phase to address:**
Phase 1 (Auth/Infrastructure). Define the internal auth pattern before building any n8n integration endpoints. This is a one-time architectural decision.

---

### Pitfall 3: Dynamic Fields Stored as Unindexed Embedded Objects Destroying Query Performance

**What goes wrong:**
Programs define custom fields (text, number, date, dropdown, checkbox, file). Requests store these as a flexible `customFields` object like `{ fieldId1: "value1", fieldId2: 42 }`. Developers embed this directly in the request document. When users try to filter/sort requests by a dynamic field value (e.g., "show me all requests where Priority is High"), the query requires scanning inside an unindexed nested object. At 10k+ requests per program, this becomes visibly slow. At 100k, it is unusable.

**Why it happens:**
MongoDB's schema flexibility makes it trivial to store dynamic fields as embedded objects. It "works" during development with 50 test records. Nobody tests with realistic data volumes. The filtering/sorting requirements emerge after the schema is locked in.

**How to avoid:**
1. **Array-of-key-value pattern:** Store dynamic fields as `customFields: [{ fieldId: ObjectId, key: "priority", value: "High", type: "dropdown" }]`. This is indexable: `db.requests.createIndex({ "customFields.fieldId": 1, "customFields.value": 1 })`.
2. **Pre-define common query patterns:** If programs frequently filter by certain field types (dropdown, date), create compound indexes on `programId + customFields.fieldId + customFields.value`.
3. **Separate values by type (if needed at scale):** For truly heterogeneous querying, store typed values: `{ fieldId, stringValue, numberValue, dateValue }`. Only populate the relevant one. This allows proper range queries on numbers/dates without string coercion.
4. **Avoid deep nesting:** Never store dynamic fields more than one level deep. `request.customFields[].value` is fine. `request.sections[].groups[].fields[].value` is a query nightmare.

**Warning signs:**
- Filter/sort on dynamic fields uses `$where` or JavaScript expressions
- Queries on dynamic fields do not appear in MongoDB slow query log during dev (too few documents) but the pattern is clearly unindexable
- No compound index exists that includes dynamic field paths
- Aggregation pipelines use `$objectToArray` to query dynamic fields

**Phase to address:**
Phase 2 (Programs/Dynamic Fields). The schema shape for `customFields` must be decided and indexed before requests are created. Migrating from `{ fieldId: value }` to `[{ fieldId, value }]` requires rewriting every document.

---

### Pitfall 4: RBAC Permission Explosion with Program-Level Scoping

**What goes wrong:**
The system has 4 roles (admin, manager, team_member, client) plus program-level permissions (which users can access which programs, who manages which program). Developers implement this as scattered `if/else` checks in route handlers: `if (user.role === 'admin') { ... } else if (user.role === 'manager' && program.managers.includes(user.id)) { ... }`. This logic duplicates across every endpoint, becomes inconsistent, and is impossible to audit. Adding a 5th role or a new permission dimension (e.g., "viewer" role) requires touching dozens of files.

**Why it happens:**
Four roles feels manageable enough to "just code it." The program-level scoping adds a second dimension that developers don't anticipate. The permission logic starts simple and accretes conditions over months.

**How to avoid:**
1. **Centralized permission evaluation:** Create a single `permissions.ts` module with functions like `canAccessProgram(user, programId)`, `canManageRequest(user, request)`, `canViewSheet(user, programId)`. Every route handler calls these functions instead of inline role checks.
2. **Permission matrix document:** Before coding, write out a matrix: rows = actions (create request, approve request, view sheet, export CSV, etc.), columns = roles + program relationship. This becomes the spec and the test plan.
3. **Middleware pattern:** Create Express middleware like `requirePermission('program:manage', { paramKey: 'programId' })` that extracts the resource ID from the request and evaluates permissions. Route definitions become declarative.
4. **Program membership as a first-class concept:** Store `ProgramMembership { userId, programId, role }` as a separate collection. A user might be a manager in Program A but a team_member in Program B. Global role (admin) is separate from program-level role.

**Warning signs:**
- Route handlers contain more than 2 lines of permission logic
- Different endpoints check the same permission differently
- "Can a client do X?" questions cannot be answered without reading multiple files
- Test suite lacks permission-specific test cases

**Phase to address:**
Phase 1 (Auth). The permission evaluation module and middleware must exist before any protected endpoint is built. Retrofitting centralized RBAC onto scattered inline checks is a rewrite of every controller.

---

### Pitfall 5: JWT Refresh Token Rotation Done Wrong

**What goes wrong:**
Three common failure modes: (a) Refresh tokens stored in localStorage (XSS-stealable). (b) Refresh token rotation implemented without a token family / reuse detection, so a stolen refresh token can be used indefinitely alongside the legitimate user. (c) No server-side token invalidation — "logout" only deletes the client-side token, but the refresh token remains valid for 7 days.

**Why it happens:**
JWT tutorials show the happy path. Rotation logic is subtle. Developers implement "store token, send token, get new token" without understanding the attack tree. HttpOnly cookies add CORS complexity that developers avoid.

**How to avoid:**
1. **HttpOnly, Secure, SameSite=Strict cookies for refresh tokens.** Never expose refresh tokens to JavaScript. Access tokens can be in memory (not localStorage).
2. **Token family tracking:** Each refresh token belongs to a `tokenFamily` (a UUID created at login). When a refresh token is used, issue a new one and invalidate the old one. If a previously-invalidated token is presented (replay attack), invalidate the entire family and force re-login.
3. **Server-side storage:** Store refresh tokens in MongoDB (or Redis) with `userId`, `tokenFamily`, `token` (hashed), `expiresAt`, `isRevoked`. Validate against this store on every refresh.
4. **Logout = server-side revocation:** On logout, mark all tokens for that user/family as revoked. On password change, revoke all families for that user.
5. **Short refresh token lifetime for clients:** Consider 24h refresh tokens for the client role instead of 7 days, since client accounts are higher-risk (external users).

**Warning signs:**
- Refresh token visible in browser DevTools Application > Local Storage
- No `refreshTokens` collection in MongoDB
- Logout endpoint only returns 200 without any server-side action
- No test for "use revoked refresh token" scenario
- Token rotation does not invalidate the old token

**Phase to address:**
Phase 1 (Auth). This is foundational. Getting refresh token security wrong in Phase 1 and fixing it later means invalidating all existing sessions and potentially losing user trust.

---

### Pitfall 6: Client Portal Data Leakage Through Aggregation and Population

**What goes wrong:**
Clients should only see requests and programs they belong to. Developers add a filter like `{ programId: { $in: userPrograms } }` to the main query but forget about: (a) Mongoose `.populate()` calls that pull in related documents without re-checking permissions. (b) Aggregation pipelines that `$lookup` across collections without filtering. (c) API responses that include `createdBy` user objects with email/name of other users the client should not see. (d) Socket.IO events broadcast to a program room that include data from other programs in the payload.

**Why it happens:**
Authorization is checked at the "entry point" (the route handler) but not at the data layer. Populate and lookup bypass the permission boundary. Developers think in terms of "this endpoint is protected" rather than "every piece of data in the response is authorized."

**How to avoid:**
1. **Query scoping at the service layer:** Every database query function for client-accessible resources takes a `scope` parameter that is always applied: `{ programId: { $in: allowedProgramIds } }`. This is not optional.
2. **Response serialization layer:** Create explicit response DTOs/serializers per role. The client serializer strips internal fields (`internalNotes`, other users' emails, admin metadata). Never return raw Mongoose documents.
3. **Populate with match conditions:** When using `.populate()`, always include `match` conditions: `.populate({ path: 'assignee', select: 'name avatar' })` — never populate full user documents to clients.
4. **Socket.IO room discipline:** Clients join only their program rooms. Verify room membership on connection and on every `join` event. Never broadcast cross-program data in a single event.
5. **Integration test per role:** For every API endpoint, write a test where a client user tries to access another program's data. This should return 403 or empty results, never leaked data.

**Warning signs:**
- API responses include fields like `email`, `phone`, or `internalNotes` that clients should not see
- No role-based response serialization — same JSON shape for admin and client
- `.populate()` calls without `select` or `match`
- No test that verifies a client cannot see another program's requests

**Phase to address:**
Phase 2 (Programs) and Phase 4 (Client Portal). The query scoping pattern must be established in Phase 2. The full client isolation verification must happen in the Client Portal phase with dedicated penetration-style tests.

---

### Pitfall 7: Socket.IO Reconnection Losing State and Duplicate Event Delivery

**What goes wrong:**
User disconnects (tab sleep, network blip, laptop lid close). Socket.IO reconnects automatically, but: (a) The client missed events during disconnection, so the UI is stale. User sees outdated request statuses. (b) On reconnect, the client re-joins rooms but the server does not re-send missed state. (c) If the server retries sending events during the disconnection window, the client might receive duplicates after reconnect. (d) Multiple browser tabs create multiple socket connections, each receiving events, causing duplicate UI updates or conflicting state.

**Why it happens:**
Socket.IO handles reconnection at the transport level but not at the application level. Developers assume reconnection = full state recovery. It is not.

**How to avoid:**
1. **Reconnect handler fetches fresh state:** On the client, listen for the `connect` event (which fires on reconnect). When it fires, re-fetch the current view's data via REST API. Do not rely on replaying missed socket events.
2. **Event idempotency:** Include a unique `eventId` (or use the AuditLog `_id`) in every socket event. Client-side event handler deduplicates by tracking the last N event IDs.
3. **Timestamp-based sync:** Include `updatedAt` in socket events. Client compares against its local state and only applies if the event is newer.
4. **Tab coordination (if needed):** Use `BroadcastChannel` API to coordinate between tabs. Designate one tab as the socket leader; others receive events via BroadcastChannel. This prevents 10 tabs = 10 socket connections.
5. **Do not queue events server-side for disconnected clients.** This adds enormous complexity (what is the queue size? when to purge? per-user memory). The REST-on-reconnect pattern is simpler and more reliable.

**Warning signs:**
- Users report "stale data" after returning to the tab
- UI shows a request in "submitted" state after it was already approved (missed the status change event)
- Multiple toasts/notifications for the same event
- Server memory grows with connected client count (suggests event buffering)

**Phase to address:**
Phase 3 (Real-time/Socket.IO). The reconnect-and-refresh pattern must be baked into the Socket.IO client wrapper from the start. Retrofitting idempotency onto an existing event system is difficult.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing dynamic field values as `{ fieldId: value }` object instead of array | Simpler reads, direct property access | Cannot index, cannot query/filter/sort by field value efficiently | Never — array-of-KV is equally simple to read and indexable |
| Skipping the webhook outbox, relying on n8n being always up | Fewer moving parts in Phase 1 | Silent notification failures, no auditability of webhook delivery, impossible to debug "email never sent" | MVP only if you accept lost notifications; must add outbox before production |
| Inline RBAC checks (`if role === 'admin'`) instead of centralized permission module | Faster to write the first 3 endpoints | Every new endpoint re-invents permission logic; inconsistencies and security gaps accumulate | Never — the permission module takes 2 hours to build and saves 20 hours of debugging |
| Single JWT secret for access + refresh tokens | One less env variable | Compromise of one token type compromises both; cannot rotate independently | Never — use separate secrets |
| Skipping response serialization (returning raw Mongoose docs) | Faster API development | Data leakage to clients, over-fetching, breaking changes when schema evolves | Dev/prototype only; must add before client portal |
| No audit log batching | Simpler code, one log per mutation | Every mutation = extra write; at scale, audit writes can exceed business writes | Acceptable for v1 if audit writes are fire-and-forget (no `await`) |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| n8n webhooks | Sending webhook payload with full Mongoose documents (including `__v`, populated refs, circular refs) | Create a dedicated webhook payload builder that serializes only necessary fields. Include `eventType`, `resourceId`, `timestamp`, and minimal context. |
| n8n -> MongoDB direct write | n8n writes directly to MongoDB, bypassing Mongoose validators, hooks, and audit logging | n8n should always call back into Express API (internal endpoints) rather than writing to MongoDB directly. This ensures validators run and audit logs are created. If direct MongoDB write is needed for performance, duplicate the validation logic in n8n (fragile). |
| n8n -> Socket.IO emit | n8n calls the internal socket-emit endpoint without including room targeting, broadcasting to all connected clients | The internal socket-emit endpoint must require a `room` (programId) parameter. Never broadcast globally from n8n. |
| Redis cache invalidation | Caching query results but not invalidating when n8n callbacks modify data | n8n callback endpoints must invalidate relevant Redis cache keys. Define a cache key naming convention (`program:{id}:requests`) and invalidate on any write path, including internal endpoints. |
| Docker Compose startup order | Express starts before MongoDB is ready, causing connection failures | Use `depends_on` with `condition: service_healthy` and add `healthcheck` to MongoDB and Redis services. Express should also have retry logic on initial connection (`mongoose.connect` with `serverSelectionTimeoutMS`). |
| Docker Compose n8n + Postgres | n8n starts before its Postgres database is ready | Add `healthcheck` to the Postgres service and `depends_on: condition: service_healthy` for n8n. n8n will crash loop without its database. |
| nginx reverse proxy | WebSocket connections fail through nginx because `Upgrade` headers are not proxied | nginx config must include `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` for the Socket.IO path. |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Audit log on every mutation as a synchronous write | API response times increase; p95 latency doubles | Write audit logs asynchronously (`AuditLog.create(data)` without `await`, or use a write-behind buffer). Accept that audit logs may lag by milliseconds. | >100 mutations/second (roughly 50+ concurrent active users) |
| Fetching all requests for a program without pagination | Sheet view takes seconds to load, browser memory spikes | Always paginate. Default `limit: 50`. Implement cursor-based pagination if page-number pagination causes skips on updates. | >500 requests per program |
| Loading all program members to check permissions | Permission check becomes a bottleneck on programs with 100+ members | Index `ProgramMembership` on `{ userId: 1, programId: 1 }` (compound unique). Check membership with a single indexed query, not by loading the full member list. | >50 members per program |
| Unindexed `createdAt` / `updatedAt` for sort operations | Default sort by "newest first" does a collection scan | Add index on `{ programId: 1, createdAt: -1 }` for the most common query pattern. | >10k requests in a single program |
| CSV/Excel import loading entire file into memory | Server OOM on large files (50k+ rows) | Use streaming parsers (`csv-parse` with stream API, `ExcelJS` streaming reader). Process rows in batches of 100-500. Report progress via Socket.IO. | >10MB file / >50k rows |
| Populating all references in list queries | `.populate('createdBy assignee program comments')` on a list of 50 requests = 200+ additional queries | Populate only what the UI needs for the list view (`createdBy: 'name avatar'`). Fetch full details on individual request view. | >20 requests per page with multiple populates |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Client role can enumerate program IDs and access programs they don't belong to | Data leakage; client sees other companies' requests | Every query for client-accessible resources must include `programId: { $in: user.allowedPrograms }`. Never trust programId from URL params alone — validate membership. |
| Internal API endpoints (`/api/v1/internal/*`) reachable from outside Docker network | Attacker can trigger n8n-level actions: emit socket events, modify data | nginx must block all `/internal/` routes from external traffic. Add IP allowlist or network-level restriction in addition to API key auth. |
| File upload allows any file type, stored with user-provided filename | Path traversal, malware upload, XSS via SVG files | Allowlist file extensions per field type config. Generate random filenames (UUID). Store in a non-web-accessible directory. Serve via a streaming endpoint with `Content-Disposition: attachment`. Scan files if possible. |
| Webhook payloads from n8n callbacks not validated | Attacker who discovers the internal API key can inject arbitrary data | Validate all n8n callback payloads with Zod schemas, same as external input. Internal does not mean trusted data shape. |
| Audit logs can be read by any authenticated user | Audit logs contain sensitive info (who rejected what, IP addresses, field changes) | Restrict audit log read access to admin and manager roles. Clients should only see their own activity (filtered by `userId`). |
| Bulk import (CSV/Excel) allows formula injection | Exported CSV opened in Excel executes formulas like `=SYSTEM()` | On import, strip leading `=`, `+`, `-`, `@` from string values. On export, prefix these characters with a single quote. |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Dynamic field configuration is disconnected from the request form | Admin configures fields in program settings but cannot preview what the form looks like | Provide a live preview of the request form while configuring fields. Show exactly what team members and clients will see. |
| No optimistic UI updates before socket confirmation | User clicks "Approve" and nothing happens for 1-2 seconds until the server responds and socket broadcasts | Apply optimistic update immediately on the client. Revert if the server returns an error. Socket event confirms and reconciles. |
| CSV import with no progress indicator or partial error reporting | User uploads 5000-row CSV, waits 30 seconds with no feedback, then gets "47 errors" with no way to find which rows failed | Stream import progress via Socket.IO (e.g., "Processed 2500/5000, 12 errors so far"). On completion, provide a downloadable error report with row numbers and specific validation failures. |
| Request history shows raw field IDs instead of human-readable labels | Audit log shows `Changed fieldId:abc123 from "A" to "B"` instead of `Changed Priority from "Low" to "High"` | Resolve field IDs to labels at display time. Store enough context in audit entries (field label at time of change) to handle field renames. |
| Sheet view tries to show all dynamic columns at once | Programs with 15+ custom fields create an unusable horizontal scroll | Allow users to toggle column visibility. Persist column preferences per user per program. Show a sensible default set (first 5-7 columns). |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Authentication:** Often missing refresh token reuse detection — verify that using an old (rotated-out) refresh token invalidates the entire token family
- [ ] **RBAC:** Often missing program-level permission checks — verify that a team_member in Program A cannot access Program B's requests, even with a valid JWT
- [ ] **Dynamic fields:** Often missing validation for dropdown options — verify that a request cannot be submitted with a dropdown value that is not in the program's configured options list
- [ ] **Socket.IO:** Often missing room authorization — verify that a client cannot `socket.emit('join', { room: 'program:other-program-id' })` and receive events from a program they don't belong to
- [ ] **File upload:** Often missing size limits and type validation — verify that uploading a 500MB file or a `.exe` is rejected, both client-side and server-side
- [ ] **CSV import:** Often missing encoding handling — verify that a CSV with BOM markers, ISO-8859-1 encoding, or CRLF line endings imports correctly
- [ ] **CSV export:** Often missing formula injection protection — verify that cells starting with `=`, `+`, `-`, `@` are escaped
- [ ] **Audit logging:** Often missing the "before" value — verify that audit entries include both `previousValue` and `newValue` for field changes, not just `newValue`
- [ ] **n8n integration:** Often missing the "n8n is down" scenario — verify that the main application works correctly (minus notifications/automation) when n8n container is stopped
- [ ] **Client portal:** Often missing request isolation in list views — verify that a client user's GET requests endpoint returns 0 results for programs they don't belong to, not a 403 (which confirms the program exists)
- [ ] **Docker Compose:** Often missing health checks — verify that `docker compose up` from a cold start (all volumes empty) succeeds without manual intervention
- [ ] **Pagination:** Often missing `total` count accuracy with filters — verify that applying filters to a paginated list returns the correct `total` count, not the unfiltered count

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Dynamic fields stored as `{ fieldId: value }` object | HIGH | Write a migration script that transforms every request document to the array-of-KV format. Update all queries, indexes, and serialization. Test against a copy of production data first. Estimate: 2-3 days. |
| No webhook outbox, lost notifications | MEDIUM | Add the outbox collection and modify all webhook call sites. For historically lost notifications, there is no recovery — they are gone. Future-proof only. Estimate: 1 day. |
| Scattered inline RBAC checks | HIGH | Audit all route handlers, extract permission logic to a central module, replace inline checks with middleware/function calls, write integration tests for every role x endpoint combination. Estimate: 3-5 days depending on endpoint count. |
| Client data leakage discovered | HIGH | Immediate: add query scoping and response serialization. Requires audit of every endpoint for information leakage. May require security disclosure depending on data sensitivity. Estimate: 2-4 days + incident response. |
| Socket.IO stale state after reconnection | LOW | Add a reconnect handler on the client that re-fetches current view data via REST. This is a client-side-only change. Estimate: 0.5 days. |
| JWT refresh tokens in localStorage | MEDIUM | Switch to HttpOnly cookies. Requires CORS configuration changes, client-side auth flow rewrite, all existing sessions invalidated (users must re-login). Estimate: 1-2 days. |
| Audit logs slowing down mutations | LOW | Switch audit log writes to fire-and-forget (remove `await`). If more throughput needed, batch writes using a small in-memory buffer that flushes every 100ms. Estimate: 0.5 days. |
| CSV formula injection in exports | LOW | Add a serialization function that prefixes dangerous characters. Apply to all CSV/Excel export paths. Estimate: 0.5 days. |
| n8n writing directly to MongoDB bypassing validators | MEDIUM | Create internal API endpoints for each write operation n8n performs. Modify n8n workflows to call API endpoints instead of direct MongoDB writes. Estimate: 1-2 days depending on number of workflows. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Fire-and-forget webhook delivery loss | Phase 1: Infrastructure | Webhook outbox collection exists; integration test stops n8n and verifies events queue; sweep workflow processes backlog |
| Internal API authentication gap | Phase 1: Auth/Infrastructure | All `/internal/` endpoints require API key; nginx blocks `/internal/` from external; penetration test confirms |
| Dynamic field query performance | Phase 2: Programs/Dynamic Fields | `customFields` stored as array-of-KV; compound index on `programId + customFields.fieldId + customFields.value` exists; explain plan shows index scan for filter queries |
| RBAC permission explosion | Phase 1: Auth | Permission matrix document exists; centralized permission module with tests; no inline role checks in route handlers |
| JWT refresh token vulnerabilities | Phase 1: Auth | Refresh token in HttpOnly cookie (not localStorage); `refreshTokens` collection exists with `tokenFamily`; test for reuse detection passes |
| Client data leakage | Phase 2: Programs + Phase 4: Client Portal | Query scoping applied to all client-accessible queries; role-based response serializers exist; integration test for client isolation per endpoint |
| Socket.IO reconnection stale state | Phase 3: Real-time | Client socket wrapper includes reconnect handler that re-fetches via REST; event deduplication by `eventId`; manual test: disconnect, make changes, reconnect, verify state |
| CSV/Excel import at scale | Phase 3: Request Books | Streaming parser used (not full file in memory); progress reported via Socket.IO; error report generated with row numbers; tested with 50k-row file |
| Audit log performance impact | Phase 1: Infrastructure | Audit log writes are non-blocking (no `await`); load test with 100 concurrent mutations shows <5% latency impact |
| Docker Compose startup reliability | Phase 1: Infrastructure | All services have health checks; `depends_on` with `condition: service_healthy`; cold-start test from empty volumes succeeds |
| n8n direct MongoDB writes bypassing validation | Phase 2: n8n Integration | No n8n workflow writes directly to MongoDB; all n8n mutations go through `/internal/` API endpoints; audit logs exist for n8n-originated changes |
| CSV formula injection | Phase 3: Request Books (export) | Export function prefixes `=`, `+`, `-`, `@` with single quote; import function strips these characters from string values |

## Sources

- MongoDB schema design patterns for dynamic/polymorphic fields: MongoDB documentation on polymorphic pattern and attribute pattern (HIGH confidence — well-documented official pattern)
- JWT refresh token rotation best practices: OWASP Authentication Cheat Sheet, Auth0 documentation on refresh token rotation (HIGH confidence — industry standard)
- Socket.IO reconnection behavior: Socket.IO official documentation on connection lifecycle (HIGH confidence — documented behavior)
- n8n webhook patterns: n8n community forums and documentation on webhook nodes and error handling (MEDIUM confidence — less standardized than other areas)
- Docker Compose health checks and startup order: Docker official documentation on `depends_on` with health checks (HIGH confidence)
- CSV injection / formula injection: OWASP CSV Injection prevention guidance (HIGH confidence)
- RBAC patterns for multi-tenant systems: general software architecture patterns (MEDIUM confidence — pattern varies by application)
- Outbox pattern for reliable event delivery: microservices transactional outbox pattern, widely documented (HIGH confidence — well-established pattern)

---
*Pitfalls research for: Request Management System with n8n automation*
*Researched: 2026-02-20*
