# Roadmap: Request Management System (RMS)

## Overview

This roadmap delivers a centralized request management system where internal teams and clients submit, track, and manage requests through configurable programs with full lifecycle visibility. The build progresses from infrastructure and authentication through the program/request core, adds real-time and automation layers, then delivers the primary UI surfaces (sheets, bulk import) and client collaboration. Eight phases deliver 66 v1 requirements across 12 categories, with every phase producing observable, verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Authentication** - Docker Compose infrastructure, JWT auth, RBAC, and user management
- [x] **Phase 2: Programs + Dynamic Fields** - Program CRUD with field configuration, boundaries, and access control
- [x] **Phase 3: Request Lifecycle + Audit** - Request CRUD, state machine, comments, attachments, history, and audit trail
- [x] **Phase 4: Real-Time Events** - Socket.IO with JWT auth, program-scoped rooms, and mutation broadcasting
- [x] **Phase 5: n8n Integration + Notifications** - Webhook outbox, n8n workflows, internal API, in-app and email notifications
- [ ] **Phase 6: Sheet Views** - Tabular request display with dynamic columns, inline CRUD, filtering, search, and CSV export
- [ ] **Phase 7: Request Books** - Excel/CSV bulk import with field mapping, validation preview, and batch creation
- [ ] **Phase 8: Client Collaboration** - Client-restricted views, scoped data access, activity feed, and real-time updates

## Phase Details

### Phase 1: Foundation + Authentication
**Goal**: Users can register, log in, and manage accounts with role-based access control, on a fully containerized infrastructure
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, USER-01, USER-02, USER-03
**Success Criteria** (what must be TRUE):
  1. Docker Compose starts all 7 services (mongo, redis, server, client, n8n, n8n_db, nginx) from cold with health checks passing
  2. User can register with email/password, log in, and receive JWT tokens that persist across browser refresh
  3. User can refresh an expired access token without re-logging in, and can log out which invalidates the session server-side
  4. Admin can create users, assign roles (admin/manager/team_member/client), edit accounts, and deactivate users
  5. Protected API endpoints reject unauthenticated requests and enforce role-based access (e.g., only admins can manage users)
**Plans**: 4 plans (3 original + 1 gap closure)

Plans:
- [x] 01-01-PLAN.md — Docker Compose infrastructure (7 services), Express skeleton, core middleware (Zod validation, pagination, error handling, Redis cache)
- [x] 01-02-PLAN.md — Authentication system (register, login, JWT access/refresh tokens, HttpOnly cookies, token family reuse detection, logout with server-side invalidation)
- [x] 01-03-PLAN.md — RBAC authorization middleware, user management CRUD (admin-only), ProgramMember model for user-program assignment
- [ ] 01-04-PLAN.md — [GAP CLOSURE] Client scaffolding (React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui new-york) to unblock Docker Compose cold start

### Phase 2: Programs + Dynamic Fields
**Goal**: Admins and managers can create and configure programs that define the organizational structure, field schemas, and access boundaries for requests
**Depends on**: Phase 1
**Requirements**: PROG-01, PROG-02, PROG-03, PROG-04, PROG-05, PROG-06
**Success Criteria** (what must be TRUE):
  1. Admin/manager can create a program with name, description, and settings, and can edit or archive it later
  2. Admin/manager can configure dynamic fields on a program (text, number, date, dropdown, checkbox, file upload) and those definitions persist
  3. Admin/manager can configure program boundaries (who can access) and timeframes, and the system enforces them
  4. Users see only the programs they have been granted access to -- no leakage of program names or data across boundaries
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — Program model with embedded dynamic field definitions, Zod schemas, CRUD service/controller/routes (create, list, get, update, archive)
- [ ] 02-02-PLAN.md — authorizeProgram middleware, program member management, access-scoped program listing (PROG-06), timeframe boundary enforcement

### Phase 3: Request Lifecycle + Audit
**Goal**: Users can create, submit, and track requests through their full lifecycle within programs, with comments, file attachments, and a complete audit trail of every change
**Depends on**: Phase 2
**Requirements**: REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-08, REQ-09, REQ-10, REQ-11, AUDIT-01, AUDIT-02, AUDIT-03
**Success Criteria** (what must be TRUE):
  1. User can create a request within a program, and the request form renders dynamic fields matching the program's field configuration
  2. User can submit a draft request, and managers can move it through the full lifecycle (submitted, in_review, approved/rejected, completed) with only valid transitions allowed
  3. User can add comments to a request and see them in an activity timeline, and can upload and download file attachments with type/size validation
  4. Every mutation (field edit, status change, assignment, comment) creates an audit log entry visible on the request detail page and in the admin audit log view
  5. Manager can assign/reassign requests to team members, and the request detail page shows all fields, comments, attachments, and complete history
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Request, Comment, Attachment, AuditLog Mongoose models, Zod schemas, state machine transitions, audit utility
- [x] 03-02-PLAN.md — Request CRUD service/controller/routes, status transitions, assignment/reassignment, audit logging on all mutations
- [x] 03-03-PLAN.md — Comment CRUD, file attachments with multer upload/download, request detail aggregation, admin audit log API, per-request audit trail

### Phase 4: Real-Time Events
**Goal**: Connected users receive instant updates when requests change within their programs, without polling or manual refresh
**Depends on**: Phase 3
**Requirements**: RT-01, RT-02, RT-03, RT-04
**Success Criteria** (what must be TRUE):
  1. Socket.IO connection requires a valid JWT -- unauthenticated connection attempts are rejected
  2. Users are automatically joined to Socket.IO rooms for their assigned programs, and events are scoped to those rooms (no global broadcasts)
  3. When a request is created, updated, or transitions state, all connected users in that program's room see the update in real-time without refreshing
  4. If a user's connection drops and reconnects, they gracefully catch up on missed changes
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Socket.IO server setup with JWT auth middleware, program-scoped room management, Redis-backed reconnection catch-up, typed event catalog
- [x] 04-02-PLAN.md — Wire emitToProgram into all 8 mutation paths (request CRUD, transitions, assignments, comments, attachments) for real-time broadcasting

### Phase 5: n8n Integration + Notifications
**Goal**: The system reliably delivers webhook events to n8n for all async processing, n8n handles email dispatch and scheduled tasks, and users receive both in-app and email notifications for key events
**Depends on**: Phase 4
**Requirements**: N8N-01, N8N-02, N8N-03, N8N-04, N8N-05, N8N-06, N8N-07, NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04
**Success Criteria** (what must be TRUE):
  1. Every mutation in Express fires a webhook POST to n8n (fire-and-forget), and a webhook outbox ensures events are not lost if n8n is temporarily unavailable
  2. n8n can call back into Express via the internal API (shared-secret auth) and can push real-time events to connected clients via the socket-emit endpoint
  3. User sees a notification bell with unread count that updates in real-time when new notifications arrive, and can mark notifications as read/unread
  4. User receives email notifications for status changes, assignments, and comments -- dispatched by n8n, not the Express backend
  5. n8n executes scheduled workflows (reminder checks) without any cron or job queue in the Express process
**Plans**: 4 plans

Plans:
- [ ] 05-01-PLAN.md — Webhook outbox model, typed event catalog (all 9 mutation types), internal API with shared-secret auth, socket-emit endpoint for n8n
- [ ] 05-02-PLAN.md — Notification Mongoose model, CRUD API (list, unread count, mark read/unread), real-time Socket.IO notification delivery
- [ ] 05-03-PLAN.md — Wire webhook dispatch and in-app notifications into all 8 mutation paths, start outbox processor on server boot
- [ ] 05-04-PLAN.md — n8n workflow JSON templates (email notifications + scheduled reminders), internal API callback endpoints, setup documentation

### Phase 6: Sheet Views
**Goal**: Users can view and manage requests in a tabular spreadsheet-like interface with dynamic columns, inline editing, and data export -- the primary daily working surface
**Depends on**: Phase 3
**Requirements**: SHEET-01, SHEET-02, SHEET-03, SHEET-04, SHEET-05, SHEET-06, SHEET-07
**Success Criteria** (what must be TRUE):
  1. User can view requests in a tabular sheet with columns dynamically generated from the program's field configuration
  2. User can create, edit, and delete request rows inline within the sheet view without navigating to separate pages
  3. User can sort by any column, filter by status/assignee/date range/custom fields, and search by keyword -- all within the sheet
  4. Sheet view is paginated (page, limit, total displayed) and user can export the current filtered view as CSV
**Plans**: 4 plans

Plans:
- [ ] 06-01-PLAN.md — Backend API enhancements: sortBy/sortOrder query params, date range filters, CSV export endpoint, delete request endpoint
- [ ] 06-02-PLAN.md — Client foundation: React Router, Axios API client with JWT refresh, auth context, login page, layout shell, program list page
- [ ] 06-03-PLAN.md — Sheet view core: dynamic data table with program field columns, sortable headers, filter toolbar, search, pagination
- [ ] 06-04-PLAN.md — Inline CRUD and CSV export: create/edit/delete request rows inline, confirmation dialogs, CSV download button

### Phase 7: Request Books
**Goal**: Users can bulk-import existing request data from Excel/CSV files into programs, with guided field mapping and validation, replacing manual data entry for migration and ongoing batch workflows
**Depends on**: Phase 3
**Requirements**: BOOK-01, BOOK-02, BOOK-03, BOOK-04, BOOK-05
**Success Criteria** (what must be TRUE):
  1. User can upload an Excel or CSV file and the system presents a field mapping UI to map file columns to the program's dynamic fields
  2. Before importing, the system shows a validation preview with clear error display (row-level errors with reasons) so the user can review before committing
  3. User can batch-import all validated rows as requests into the program in a single action
  4. The system tracks import history (who, when, how many records, how many errors) and this history is viewable
**Plans**: 3 plans

Plans:
- [ ] 07-01-PLAN.md — Backend: ImportJob model, xlsx dependency, file parsing service, row validation against program fields, batch request creation, import history API
- [ ] 07-02-PLAN.md — Frontend: Import wizard page with file upload (drag-and-drop), column-to-field mapping UI, validation preview with row-level errors, batch import execution and result summary
- [ ] 07-03-PLAN.md — Frontend: Import history page with paginated table of past imports, status badges, sheet toolbar integration

### Phase 8: Client Collaboration
**Goal**: External client users can access the same application with restricted views, create and track their own requests, and receive real-time updates -- without seeing data from other programs or internal-only information
**Depends on**: Phase 5
**Requirements**: CLIENT-01, CLIENT-02, CLIENT-03, CLIENT-04, CLIENT-05, CLIENT-06
**Success Criteria** (what must be TRUE):
  1. Client role users see only the programs they are explicitly assigned to -- no other program names, data, or metadata are visible or accessible via API
  2. Client can create and submit requests within their assigned programs and view the status and full history of their own requests
  3. Client can add comments and file attachments to their requests and sees an activity feed of updates within their program
  4. Client receives real-time Socket.IO updates when their requests change, scoped to their program rooms only
**Plans**: 3 plans

Plans:
- [ ] 08-01-PLAN.md — Backend client access guard rails: ownership checks on request detail, comment/attachment deletion, import route restriction
- [ ] 08-02-PLAN.md — Request detail page with comments timeline, file attachments, audit history, and navigation from sheet view
- [ ] 08-03-PLAN.md — Socket.IO client integration, client-aware UI restrictions, and program activity feed

### Phase 9: Due Dates & Reminders
**Goal**: Requests have configurable due dates with visual indicators, a calendar view for deadline planning, and automated reminders for upcoming/overdue items via n8n
**Depends on**: Phase 3 (Request model), Phase 5 (n8n integration, existing reminder endpoint)
**Requirements**: DUE-01, DUE-02, DUE-03, DUE-04
**Success Criteria** (what must be TRUE):
  1. Admin/manager can configure due date rules on a program (default offset from creation, field-level overrides)
  2. Requests display a computed due date in the sheet view column and on the request detail page, with overdue/due-soon visual indicators
  3. User can open a calendar view page that renders requests on their due dates, color-coded by status, with month and week views
  4. n8n reminder workflow checks actual due dates (not just staleness) and sends reminder notifications for upcoming and overdue requests
**Plans**: 3 plans

Plans:
- [ ] 09-01-PLAN.md — Backend: Program dueDateConfig, Request dueDate field, due date computation at creation, dueDate sort/filter, updated pending-reminders API
- [ ] 09-02-PLAN.md — Frontend: Due Date column in sheet view with overdue/due-soon indicators, due date in request detail, calendar view page with month/week views
- [ ] 09-03-PLAN.md — n8n workflow JSON template for due-date-based reminder notifications (daily schedule, overdue + upcoming checks, email + in-app)

### Phase 10: Sequential Request Chains
**Goal**: Requests can be linked into ordered chains so that completing one automatically activates the next, enabling sequential multi-step workflows within a program
**Depends on**: Phase 3 (Request model, state machine)
**Requirements**: CHAIN-01, CHAIN-02, CHAIN-03, CHAIN-04
**Success Criteria** (what must be TRUE):
  1. Admin/manager can create a chain of requests with defined order (chain name, sequence numbers)
  2. When a request in a chain is completed, the next request in the sequence auto-transitions from draft to submitted
  3. User can view chain status on request detail page showing all steps with their status (done/active/pending)
  4. Sheet view shows chain membership as a column, and chain progress is visible at a glance
**Plans**: 2 plans

Plans:
- [ ] 10-01-PLAN.md — Backend: RequestChain model, chain CRUD API, auto-transition on completion, chain context in request detail
- [ ] 10-02-PLAN.md — Frontend: ChainStatusPanel on request detail page, Chain column in sheet view table

### Phase 11: HSSP Compliance
**Goal**: Health & Safety compliance programs can define checklist fields, track completion status across requests, and provide structured review views for compliance monitoring
**Depends on**: Phase 2 (Program config, dynamic fields), Phase 6 (Sheet view)
**Requirements**: HSSP-01, HSSP-02, HSSP-03, HSSP-04
**Success Criteria** (what must be TRUE):
  1. Dynamic fields support a new "checklist" type — a list of items each with checked/unchecked state, rendered as checkboxes in the request form
  2. Programs can be tagged with a compliance type (e.g., HSSP) and show compliance-specific indicators in the program list
  3. A compliance review view shows aggregated checklist completion status across all requests in a compliance-tagged program
  4. Sheet view renders a completion percentage column for checklist fields, enabling at-a-glance HSSP review
**Plans**: 2 plans

Plans:
- [x] 11-01-PLAN.md — Backend: checklist field type, complianceType on Program model, checklist validation, compliance review aggregation API, CSV export support
- [ ] 11-02-PLAN.md — Frontend: checklist rendering in forms/detail/sheet, compliance badge on programs, ComplianceReviewPage with aggregated completion data

### Phase 12: Reports & Dashboard
**Goal**: Users can generate and view reports on request metrics, program performance, and overdue items, with async report generation handled by n8n
**Depends on**: Phase 9 (Due dates for overdue reports), Phase 5 (n8n webhooks)
**Requirements**: RPT-01, RPT-02, RPT-03, RPT-04
**Success Criteria** (what must be TRUE):
  1. User can generate a summary report showing request counts grouped by status, program, and timeframe
  2. User can generate a program-level report with field value distributions and average lifecycle durations
  3. User can generate an overdue request report listing all requests past their due date with days overdue
  4. Report generation triggers via n8n webhook and results are stored for retrieval — no blocking the UI
**Plans**: TBD (to be created by /gsd:plan-phase 12)

### Phase 13: Enhanced Program Boundaries
**Goal**: Programs can enforce granular limits (per-user request caps, total active request limits) with clear feedback when boundaries are reached, and admins can monitor boundary utilization
**Depends on**: Phase 2 (Program config)
**Requirements**: BOUND-01, BOUND-02, BOUND-03
**Success Criteria** (what must be TRUE):
  1. Admin/manager can configure per-user active request limits on a program (in addition to existing maxActiveRequests)
  2. When a user tries to create a request that would exceed limits, they receive a clear error message explaining which boundary was hit
  3. Program management view shows boundary utilization indicators (e.g., "42/100 active requests", "User X: 3/5 limit")
**Plans**: TBD (to be created by /gsd:plan-phase 13)

## Progress

### v1 Milestone (Complete)

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8
(Phases 6 and 7 depend on Phase 3 but are sequenced after Phase 5 for clean build order)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Authentication | 4/4 | Complete | 2026-02-20 |
| 2. Programs + Dynamic Fields | 2/2 | Complete | 2026-02-20 |
| 3. Request Lifecycle + Audit | 3/3 | Complete | 2026-02-20 |
| 4. Real-Time Events | 2/2 | Complete | 2026-02-22 |
| 5. n8n Integration + Notifications | 4/4 | Complete | 2026-02-22 |
| 6. Sheet Views | 4/4 | Complete | 2026-02-22 |
| 7. Request Books | 3/3 | Complete | 2026-02-23 |
| 8. Client Collaboration | 3/3 | Complete | 2026-02-23 |

### v2 Milestone — Scope Document Gap Closure

**Execution Order:**
9 -> 10 -> 11 -> 12 -> 13
(Phase 12 depends on Phase 9 for overdue reports. Phases 10, 11, 13 are independent of each other.)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 9. Due Dates & Reminders | 0/3 | Complete    | 2026-02-23 |
| 10. Sequential Request Chains | 2/2 | Complete    | 2026-02-23 |
| 11. HSSP Compliance | 2/2 | Complete    | 2026-02-23 |
| 12. Reports & Dashboard | 0/? | Not started | - |
| 13. Enhanced Program Boundaries | 0/? | Not started | - |
