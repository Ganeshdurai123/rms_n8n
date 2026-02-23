# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Internal teams and clients can submit, track, and manage requests through configurable programs with full lifecycle visibility
**Current focus:** v2 Milestone — Scope Document Gap Closure (Executing)

## Current Position

Milestone: v2 (Scope Document Gap Closure)
Phase: 9 of 13 (Due Dates & Reminders)
Plan: 3 of 3 in current phase (all complete)
Status: Phase 9 complete
Last activity: 2026-02-23 -- Completed 09-02 (due date UI indicators + calendar view)

v1 Progress: [████████████] 100% (8/8 phases, 66/66 requirements)
v2 Progress: [░░░░░░░░░░░░] 0% (0/5 phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 28
- Average duration: 7min
- Total execution time: 3.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-authentication | 4 | 29min | 7.3min |
| 02-programs-dynamic-fields | 2 | 21min | 10.5min |
| 03-request-lifecycle-audit | 3 | 24min | 8min |
| 04-real-time-events | 2 | 6min | 3min |
| 05-n8n-integration-notifications | 4 | 26min | 6.5min |
| 06-sheet-views | 4 | 39min | 9.8min |
| 07-request-books | 3 | 11min | 3.7min |
| 08-client-collaboration | 3 | 10min | 3.3min |

**Recent Trend:**
- Last 5 plans: 08-02 (3min), 08-03 (4min), 09-01 (4min), 09-03 (2min), 09-02 (4min)
- Trend: accelerating

*Updated after each plan completion*
| Phase 04 P01 | 4min | 2 tasks | 5 files |
| Phase 04 P02 | 2min | 2 tasks | 3 files |
| Phase 05 P01 | 2min | 2 tasks | 7 files |
| Phase 05 P02 | 12min | 2 tasks | 8 files |
| Phase 05 P03 | 5min | 2 tasks | 4 files |
| Phase 05 P04 | 7min | 2 tasks | 5 files |
| Phase 06 P01 | 3min | 2 tasks | 7 files |
| Phase 06 P02 | 14min | 2 tasks | 17 files |
| Phase 06 P03 | 15min | 3 tasks | 11 files |
| Phase 06 P04 | 7min | 2 tasks | 8 files |
| Phase 07 P01 | 5min | 2 tasks | 8 files |
| Phase 07 P02 | 4min | 2 tasks | 11 files |
| Phase 07 P03 | 2min | 1 tasks | 4 files |
| Phase 08 P01 | 3min | 2 tasks | 6 files |
| Phase 08 P02 | 3min | 2 tasks | 12 files |
| Phase 08 P03 | 4min | 2 tasks | 7 files |
| Phase 09 P01 | 4min | 2 tasks | 7 files |
| Phase 09 P02 | 4min | 2 tasks | 7 files |
| Phase 09 P03 | 2min | 1 tasks | 1 files |

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
- 04-01: Socket.IO JWT auth via socket.handshake.auth.token (standard Socket.IO auth field, not query params)
- 04-01: Program rooms use 'program:{programId}' naming convention for namespace clarity
- 04-01: Redis sorted sets (ZADD/ZRANGEBYSCORE) for reconnection catch-up with 5-min TTL and max 50 events
- 04-01: emitToProgram is fire-and-forget -- if Socket.IO not initialized, logs warning and returns (matches audit pattern)
- 04-01: ClientToServerEvents empty for v1 -- clients only receive, never push events to server
- 04-02: getPerformerName helper duplicated in each service file to avoid circular imports between service modules
- 04-02: Fire-and-forget via .then().catch(() => {}) pattern ensures socket emissions never delay HTTP responses or throw errors
- 04-02: Updated data property includes mutation-specific context (changedFields, from/to status, previousAssignee) for rich client updates
- 05-01: Outbox stores events even when N8N_WEBHOOK_BASE_URL is unset -- events accumulate for later dispatch
- 05-01: Exponential backoff uses retryCount * 30s formula for simple, predictable retry spacing
- 05-01: internalAuth uses crypto.timingSafeEqual with Buffer.from() and length pre-check to prevent timing attacks
- 05-01: Socket-emit constructs SocketEventPayload from n8n request body to satisfy typed Socket.IO emit signature
- 05-02: User-targeted socket emission via io.sockets.sockets iteration (not program rooms) since notifications are per-user
- 05-02: Fire-and-forget createNotification for internal use vs throwing createNotificationFromInternal for n8n internal API
- 05-02: read-all route mounted before parameterized :notificationId routes to prevent Express misparse
- 05-02: Notification routes require only JWT auth, not role-based authorization -- all users manage their own notifications
- 05-03: Webhook enqueue calls placed inside existing getPerformerName().then() blocks to reuse performer data and avoid double DB lookups
- 05-03: Notifications only for high-signal events: status changes, assignments, comments -- not creates, updates, or attachments
- 05-03: Self-notification suppressed: assignee not notified on self-assignment, creator not notified on own transition
- 05-03: Outbox processor interval set to 10 seconds for reasonable dispatch latency without excessive polling
- 05-04: n8n workflow JSONs are importable templates with placeholder SMTP credentials -- user configures in n8n credential manager
- 05-04: getPendingReminders uses 48-hour staleness threshold for submitted/in_review requests, limited to 100 results
- 05-04: createNotificationHandler validates notification type against NOTIFICATION_TYPES enum to reject invalid types from n8n
- 05-04: Both n8n workflows set active: false by default so users must configure SMTP before activation
- 06-01: Checkbox field filter values cast from string 'true'/'false' to boolean for proper MongoDB Map matching
- 06-01: CSV escaping follows RFC 4180 -- double-quote wrapping for commas, quotes, or newlines with inner quotes doubled
- 06-01: GET /export route placed before /:requestId to prevent Express misparse of 'export' as requestId
- 06-01: Sort type explicitly annotated as Record<string, 1 | -1> to satisfy Mongoose SortOrder type constraint
- 06-02: Access token stored in module-level variable (not localStorage) -- prevents XSS token theft
- 06-02: Refresh interceptor uses isRefreshing flag + failedQueue to prevent simultaneous refresh attempts and replay queued requests
- 06-02: AuthProvider checks session on mount via GET /auth/me -- supports page refresh without re-login
- 06-02: shadcn CLI resolved @ alias literally on Windows -- manually relocated generated files from client/@/ to client/src/
- 06-03: shadcn/ui components created manually (not via CLI) due to Windows path alias resolution issue found in 06-02
- 06-03: Debounced search uses setTimeout/clearTimeout pattern with 300ms delay in useEffect
- 06-03: Members endpoint data mapped with userId population fallback for assignee filter compatibility
- 06-03: Custom field filters render only for dropdown and checkbox types -- text/number/date not practical as toolbar filters
- 06-04: shadcn/ui dialog and alert-dialog created manually (not via CLI) consistent with Windows path workaround from 06-02
- 06-04: InlineEditRow computes diff against original request before PATCH to avoid sending unchanged fields
- 06-04: SheetRowActions uses Radix AlertDialog (not window.confirm) for delete confirmation -- design system consistency
- 06-04: CSV export uses blob download pattern with temporary anchor element for cross-browser file download
- 06-04: Actions column always rendered in table since row actions are integral to sheet view experience
- 07-01: Renamed ImportJob 'errors' field to 'importErrors' to avoid conflict with Mongoose Document.errors (ValidationError) property
- 07-01: Store titleColumn/descriptionColumn in columnMapping using reserved __title__/__description__ keys for cross-step state
- 07-01: File filter accepts both MIME type AND extension check for CSV (sometimes detected as text/plain)
- 07-01: Import routes mounted before /:requestId in request.routes.ts (same pattern as /export route)
- 07-01: Row-level validation collects errors instead of throwing -- enables partial import preview
- 07-02: Progress and ScrollArea UI components use plain div-based implementations (no Radix) since packages not installed
- 07-02: Import button in SheetToolbar visible to admin/manager roles only via userRole prop check
- 07-02: Column mapping uses __skip__/__title__/__description__ sentinel values matching backend reserved key convention from 07-01
- 07-02: Wizard state managed via useState in ImportWizardPage -- linear flow does not require external state library
- 07-03: Import History route placed before /import in App.tsx so React Router matches /import/history first
- 07-03: Import History button uses ghost variant in SheetToolbar as secondary action next to primary Import button
- 07-03: Status badges use outline variant with custom color classes for completed/validated/pending/failed states
- 07-03: SheetPagination reused from sheet view for consistent pagination UX in import history
- [Phase 08]: Client ownership checks placed after DB fetch (not query filter) for 403 vs 404 distinction
- [Phase 08]: getRequestById restructured to unified flow so ownership check applies to both cached and DB-fetched results
- [Phase 08]: Explicit client checks added before existing isAuthor/isPrivileged logic in comment and attachment delete for clarity
- [Phase 08]: Import routes restricted via authorizeProgram({ roles: ['manager'] }) -- admin bypasses automatically
- 08-02: Tabs component built with React context pattern (no Radix) consistent with Windows path workaround from 06-02
- 08-02: Blob download pattern for attachments (same as CSV export in Phase 6) via api.get responseType blob
- 08-02: SheetTable already had onRowClick prop -- wired up from SheetViewPage with navigate callback
- 08-02: AlertDialog used for attachment delete confirmation -- design system consistency with 06-04
- 08-03: Socket.IO client connects to window.location.origin (same host behind nginx proxy) for environment portability
- 08-03: useSocket hook stores handlers in ref to avoid re-registering listeners on handler identity changes
- 08-03: lastEventTimestamp tracked module-level for reconnection catch-up matching server-side Redis pattern
- 08-03: Activity feed is real-time-only in v1 -- starts empty and fills as events arrive (no audit API pre-population)
- 08-03: SheetRowActions unchanged -- canEdit/canDelete already respect role and ownership from Phase 06

- 09-01: dueDateConfig defaults enabled=false, defaultOffsetDays=30 -- programs opt-in to due dates
- 09-01: computeDueDate prefers dueDateField value over defaultOffsetDays when both available
- 09-01: Compound index {programId, dueDate} for calendar/reminder queries
- 09-01: Pending reminders uses $or for combined overdue+upcoming when type param not specified
- 09-01: daysOverdue uses negative values to indicate days until due (for n8n email template logic)

- 09-02: Due Date column conditionally shown only when at least one request has dueDate -- no column clutter for programs without due dates
- 09-02: Three-tier indicator: red (overdue), orange (due within 3 days), green (on-track, detail page only)
- 09-02: Calendar uses Monday-based weeks with month range extended to full weeks for grid alignment
- 09-02: Calendar button placed in SheetViewPage header (not sidebar) since no program-scoped sidebar nav exists
- 09-02: Calendar items limited to 3 per day cell in month view with +N more overflow indicator

- 09-03: n8n workflow set active: false by default -- user must configure SMTP credentials before enabling
- 09-03: Schedule Trigger cron 0 8 * * * (daily 8AM) as configurable default
- 09-03: splitOut node used instead of splitInBatches for simpler per-item processing
- 09-03: Email subject dynamically switches overdue/upcoming templates based on daysOverdue value
- 09-03: notification.model.ts already had 'reminder' type -- no model modification needed

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag: Package versions in STACK.md are from training data (May 2025 cutoff) -- verify with npm before locking package.json in Phase 1
- Research flag: n8n workflow JSON schema and MongoDB connector behavior need live verification during Phase 5
- Research flag: Request book import wizard UI has no canonical pattern -- may need UX research during Phase 7 planning

## Session Continuity

Last session: 2026-02-23
Stopped at: Completed 09-02-PLAN.md (due date UI indicators + calendar view) -- all Phase 9 plans complete
Resume file: None
