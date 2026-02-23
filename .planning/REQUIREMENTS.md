# Requirements: Request Management System (RMS)

**Defined:** 2026-02-20
**Core Value:** Internal teams and clients can submit, track, and manage requests through configurable programs with full lifecycle visibility

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can register with email and password
- [x] **AUTH-02**: User can log in and receive JWT access token (15min) and refresh token (7d)
- [x] **AUTH-03**: User can refresh expired access token using refresh token (HttpOnly cookie)
- [x] **AUTH-04**: User session persists across browser refresh via stored tokens
- [x] **AUTH-05**: User can log out (invalidates refresh token server-side)
- [x] **AUTH-06**: System enforces RBAC with 4 roles: admin, manager, team_member, client

### User Management

- [x] **USER-01**: Admin can create new users and assign roles
- [x] **USER-02**: Admin can view, edit, and deactivate user accounts
- [x] **USER-03**: Admin can assign users to programs with specific roles

### Programs

- [x] **PROG-01**: Admin/manager can create a program with name, description, and settings
- [x] **PROG-02**: Admin/manager can configure dynamic fields per program (text, number, date, dropdown, checkbox, file upload)
- [x] **PROG-03**: Admin/manager can configure program boundaries (who can access, submission rules)
- [x] **PROG-04**: Admin/manager can configure program timeframes
- [x] **PROG-05**: Admin/manager can edit and archive programs
- [x] **PROG-06**: Users see only programs they have access to

### Sheets

- [x] **SHEET-01**: User can view requests in a tabular sheet view with dynamic columns from program config
- [x] **SHEET-02**: User can perform inline row CRUD (create, edit, delete) in the sheet view
- [x] **SHEET-03**: User can sort columns in the sheet view
- [x] **SHEET-04**: User can filter rows by status, assignee, date range, and custom field values
- [x] **SHEET-05**: User can search requests by keyword within a sheet
- [x] **SHEET-06**: Sheet view supports pagination (page, limit, total)
- [x] **SHEET-07**: User can export current sheet view (with applied filters) as CSV

### Requests

- [x] **REQ-01**: User can create a new request within a program (status: draft)
- [x] **REQ-02**: Request form renders dynamic fields based on program configuration
- [x] **REQ-03**: User can submit a draft request (draft -> submitted)
- [x] **REQ-04**: Manager can move request through lifecycle states (submitted -> in_review -> approved/rejected -> completed)
- [x] **REQ-05**: System validates state transitions (only allowed transitions by authorized roles)
- [x] **REQ-06**: User can add comments to a request with activity timeline
- [x] **REQ-07**: User can upload file attachments to a request (with type and size validation)
- [x] **REQ-08**: User can download file attachments from a request
- [x] **REQ-09**: System tracks complete history of all changes to a request (field edits, status changes, assignments)
- [x] **REQ-10**: Manager can assign/reassign requests to team members
- [x] **REQ-11**: User can view request detail page with all fields, comments, attachments, and history

### Client Collaboration

- [x] **CLIENT-01**: Client role users see only programs they are assigned to
- [x] **CLIENT-02**: Client can create and submit requests within their assigned programs
- [x] **CLIENT-03**: Client can view status and history of their own requests
- [x] **CLIENT-04**: Client can add comments and attachments to their requests
- [x] **CLIENT-05**: Client sees activity feed of updates within their program
- [x] **CLIENT-06**: Client receives real-time updates via Socket.IO when their requests change

### Request Books

- [x] **BOOK-01**: User can upload Excel/CSV files for bulk request import
- [x] **BOOK-02**: System presents field mapping UI to map file columns to program fields
- [x] **BOOK-03**: System shows validation preview with error display before import
- [x] **BOOK-04**: User can batch import validated rows as requests into a program
- [x] **BOOK-05**: System tracks import history (who imported, when, how many records, errors)

### Notifications

- [x] **NOTIF-01**: User receives in-app notifications (bell icon with unread count)
- [x] **NOTIF-02**: In-app notifications update in real-time via Socket.IO
- [x] **NOTIF-03**: User receives email notifications for key events (status changes, assignments, comments) via n8n
- [x] **NOTIF-04**: User can mark notifications as read/unread

### n8n Integration

- [x] **N8N-01**: Express backend fires webhook POST to n8n after every mutation (fire-and-forget)
- [x] **N8N-02**: System implements webhook outbox pattern for reliable event delivery
- [x] **N8N-03**: System exposes internal API (/api/v1/internal/) for n8n callbacks with shared-secret auth
- [x] **N8N-04**: System exposes POST /api/v1/internal/socket-emit for n8n to push real-time events
- [x] **N8N-05**: System maintains typed event catalog defining all webhook payloads
- [x] **N8N-06**: n8n workflows handle email dispatch for all notification events
- [x] **N8N-07**: n8n workflows handle scheduled reminder checks

### Real-Time

- [x] **RT-01**: System maintains Socket.IO rooms per programId
- [x] **RT-02**: All request mutations broadcast updates to relevant program rooms
- [x] **RT-03**: Socket.IO connection requires valid JWT authentication
- [x] **RT-04**: System handles client reconnection gracefully (catch-up on missed events)

### Audit

- [x] **AUDIT-01**: Every mutation creates an AuditLog entry (who, what, when, before/after)
- [x] **AUDIT-02**: Admin can view system-wide audit log with filtering
- [x] **AUDIT-03**: Users can view audit trail per request

### Infrastructure

- [x] **INFRA-01**: Docker Compose orchestrates all services (mongo, redis, server, client, n8n, n8n_db postgres, nginx)
- [x] **INFRA-02**: All API inputs validated with Zod schemas
- [x] **INFRA-03**: All list endpoints support pagination (page, limit, total)
- [x] **INFRA-04**: Redis caching for frequently accessed data (program configs, user sessions)

## v2 Requirements — Scope Document Gap Closure

Active milestone. Closes gaps identified by comparing scope document against v1 codebase.

### Due Dates & Reminders

- [x] **DUE-01**: Admin/manager can configure due date rules per program (default offset, field-level overrides)
- [x] **DUE-02**: Requests display due dates based on program rules (sheet column + request detail)
- [x] **DUE-03**: User can view requests in a calendar view (month/week, color-coded by status)
- [x] **DUE-04**: Reminder rules stored in DB, n8n reads and sends reminders for upcoming/overdue deadlines

### Sequential Request Chains

- [x] **CHAIN-01**: Admin/manager can create request chains — ordered sequence of linked requests within a program
- [x] **CHAIN-02**: When a request in a chain completes, the next request auto-transitions to submitted/active
- [ ] **CHAIN-03**: User can view chain status showing which step is active, done, or pending
- [ ] **CHAIN-04**: Chain progress visible on request detail page and as a column in sheet view

### HSSP Compliance

- [ ] **HSSP-01**: System supports a checklist field type for dynamic fields (list of items with checked/unchecked state)
- [ ] **HSSP-02**: Program can be tagged with a compliance type (e.g., HSSP) with compliance-specific indicators
- [ ] **HSSP-03**: Compliance review view showing checklist completion status across requests in a program
- [ ] **HSSP-04**: HSSP information review integrated into sheet/list view with completion percentage column

### Reports & Dashboard

- [ ] **RPT-01**: User can generate summary reports (request counts by status, program, timeframe)
- [ ] **RPT-02**: User can generate program-level reports (field distributions, average lifecycle time)
- [ ] **RPT-03**: User can generate overdue request reports (requires due dates)
- [ ] **RPT-04**: Report generation runs asynchronously via n8n webhook

### Enhanced Program Boundaries

- [ ] **BOUND-01**: Per-user active request limits within a program (configurable by admin/manager)
- [ ] **BOUND-02**: maxActiveRequests enforcement on request creation (reject with clear message when limit reached)
- [ ] **BOUND-03**: Boundary compliance indicators in program management view (usage vs limits)

### Enhancements (deferred beyond v2)

- **ENH-01**: Bulk actions on sheet (bulk status change, bulk assignment)
- **ENH-02**: Request templates (pre-filled forms per request type)
- **ENH-03**: @mentions in comments with notification
- **ENH-04**: Personal dashboard (my requests, my approvals, overdue)
- **ENH-05**: Saved filters per sheet view

## Out of Scope

| Feature | Reason |
|---------|--------|
| Separate client portal (different app/domain) | Complexity of maintaining two codebases; same-app restricted views suffice |
| BullMQ / in-process job queues | n8n handles all async work; Redis stays cache-only |
| node-cron / backend scheduled tasks | n8n handles all scheduled tasks with GUI and retry logic |
| nodemailer / backend email sending | n8n handles all email dispatch with template management |
| Conditional/calculated fields | Exponential complexity; standard field types sufficient for v1 |
| Kanban/board view | Table/sheet view is primary interface; add only if user demand validates |
| Real-time collaborative editing | CRDT/OT complexity too high; optimistic locking with conflict notification instead |
| Custom workflow builder | n8n IS the workflow builder; fixed lifecycle sufficient |
| Native mobile app | Web-first with responsive design; PWA-capable if needed |
| Multi-tenancy (SaaS model) | Single-tenant deployment; each org runs own Docker Compose stack |
| AI-powered request routing | Premature; manual assignment by managers for v1 |
| Granular field-level permissions | Permission explosion; program-level access sufficient |
| OAuth/SSO login | Email/password sufficient for v1; add SSO if enterprise demand |
| User invite flow via email | Admin creates users directly for v1 simplicity |
| Token family tracking | ~~Removed from out-of-scope~~ — included in v1 for security (reuse detection prevents token theft) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| USER-01 | Phase 1 | Complete |
| USER-02 | Phase 1 | Complete |
| USER-03 | Phase 1 | Complete |
| PROG-01 | Phase 2 | Complete |
| PROG-02 | Phase 2 | Complete |
| PROG-03 | Phase 2 | Complete |
| PROG-04 | Phase 2 | Complete |
| PROG-05 | Phase 2 | Complete |
| PROG-06 | Phase 2 | Complete |
| REQ-01 | Phase 3 | Complete |
| REQ-02 | Phase 3 | Complete |
| REQ-03 | Phase 3 | Complete |
| REQ-04 | Phase 3 | Complete |
| REQ-05 | Phase 3 | Complete |
| REQ-06 | Phase 3 | Complete |
| REQ-07 | Phase 3 | Complete |
| REQ-08 | Phase 3 | Complete |
| REQ-09 | Phase 3 | Complete |
| REQ-10 | Phase 3 | Complete |
| REQ-11 | Phase 3 | Complete |
| AUDIT-01 | Phase 3 | Complete |
| AUDIT-02 | Phase 3 | Complete |
| AUDIT-03 | Phase 3 | Complete |
| RT-01 | Phase 4 | Complete |
| RT-02 | Phase 4 | Complete |
| RT-03 | Phase 4 | Complete |
| RT-04 | Phase 4 | Complete |
| N8N-01 | Phase 5 | Complete |
| N8N-02 | Phase 5 | Complete |
| N8N-03 | Phase 5 | Complete |
| N8N-04 | Phase 5 | Complete |
| N8N-05 | Phase 5 | Complete |
| N8N-06 | Phase 5 | Complete |
| N8N-07 | Phase 5 | Complete |
| NOTIF-01 | Phase 5 | Complete |
| NOTIF-02 | Phase 5 | Complete |
| NOTIF-03 | Phase 5 | Complete |
| NOTIF-04 | Phase 5 | Complete |
| SHEET-01 | Phase 6 | Complete |
| SHEET-02 | Phase 6 | Complete |
| SHEET-03 | Phase 6 | Complete |
| SHEET-04 | Phase 6 | Complete |
| SHEET-05 | Phase 6 | Complete |
| SHEET-06 | Phase 6 | Complete |
| SHEET-07 | Phase 6 | Complete |
| BOOK-01 | Phase 7 | Complete |
| BOOK-02 | Phase 7 | Complete |
| BOOK-03 | Phase 7 | Complete |
| BOOK-04 | Phase 7 | Complete |
| BOOK-05 | Phase 7 | Complete |
| CLIENT-01 | Phase 8 | Complete |
| CLIENT-02 | Phase 8 | Complete |
| CLIENT-03 | Phase 8 | Complete |
| CLIENT-04 | Phase 8 | Complete |
| CLIENT-05 | Phase 8 | Complete |
| CLIENT-06 | Phase 8 | Complete |

**v1 Coverage:**
- v1 requirements: 66 total
- Mapped to phases: 66
- Unmapped: 0

### v2 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DUE-01 | Phase 9 | Planned |
| DUE-02 | Phase 9 | Planned |
| DUE-03 | Phase 9 | Planned |
| DUE-04 | Phase 9 | Planned |
| CHAIN-01 | Phase 10 | Planned |
| CHAIN-02 | Phase 10 | Planned |
| CHAIN-03 | Phase 10 | Planned |
| CHAIN-04 | Phase 10 | Planned |
| HSSP-01 | Phase 11 | Planned |
| HSSP-02 | Phase 11 | Planned |
| HSSP-03 | Phase 11 | Planned |
| HSSP-04 | Phase 11 | Planned |
| RPT-01 | Phase 12 | Planned |
| RPT-02 | Phase 12 | Planned |
| RPT-03 | Phase 12 | Planned |
| RPT-04 | Phase 12 | Planned |
| BOUND-01 | Phase 13 | Planned |
| BOUND-02 | Phase 13 | Planned |
| BOUND-03 | Phase 13 | Planned |

**v2 Coverage:**
- v2 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-23 after v2 milestone creation*
