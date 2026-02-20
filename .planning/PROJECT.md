# Request Management System (RMS)

## What This Is

A centralized internal operations platform for managing request sheets, tracking request lifecycles, configuring program boundaries, enabling client collaboration, and integrating request books — with all background automation handled by self-hosted n8n. Teams and external clients submit requests through programs, managers approve them, and n8n handles all async work (emails, reminders, report generation).

## Core Value

Internal teams and clients can submit, track, and manage requests through configurable programs with full lifecycle visibility — from draft to completion — without manual follow-ups or disjointed spreadsheets.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Authentication with JWT (access 15min + refresh 7d) and RBAC (admin/manager/team_member/client)
- [ ] Program CRUD with boundary config, timeframe config, and dynamic field config
- [ ] Dynamic sheet columns with inline row CRUD, permissions, and CSV export
- [ ] Request full lifecycle (draft→submitted→in_review→approved/rejected→completed)
- [ ] Dynamic request fields driven by program configuration
- [ ] Request comments, file attachments, and history tracking
- [ ] Client collaboration via restricted same-app portal with activity feed
- [ ] Real-time updates via Socket.IO (rooms per programId)
- [ ] Request books: Excel/CSV import, field mapping config, validation, batch import to requests
- [ ] In-app + email notifications dispatched via n8n
- [ ] n8n webhook integration (Express fires webhook POSTs, n8n calls back or writes to MongoDB)
- [ ] n8n automation workflows designed for: status changes, assignments, reminders, email dispatch, report generation
- [ ] Due dates with configurable rules per program, calendar view, reminders via n8n (v2)
- [ ] Reports: summary, program-level, overdue — async generation via n8n webhook (v2)

### Out of Scope

- Separate client portal UI — clients use same app with restricted views
- BullMQ / any in-process job queue — n8n replaces all background job processing
- node-cron — n8n handles all scheduled tasks
- nodemailer in backend — n8n handles all email sending
- Advanced field types (conditional fields, calculated fields) — standard types only (text, number, date, dropdown, checkbox, file upload)
- Mobile native app — web-first

## Context

**Problem:** Teams currently manage requests across spreadsheets, email threads, and manual tracking. No unified view, no automation, no audit trail. Clients have no self-service portal — everything goes through email.

**Request flow:** Both internal team members and external clients create requests within programs. Managers review and approve/reject. The system tracks every state transition with audit logs.

**Programs** are the organizational unit — each program defines its own field configuration, boundary rules, and permissions. Sheets are the tabular view of requests within a program.

**Request books** are existing Excel/CSV files containing bulk request data that need to be imported into the system with field mapping and validation.

**n8n integration pattern:** Express backend fires fire-and-forget webhook POSTs to n8n after mutations. n8n processes asynchronously and calls back into Express API or writes directly to MongoDB. Failures in n8n never break the main application.

**Internal socket endpoint:** POST /api/v1/internal/socket-emit allows n8n to push real-time events to connected clients.

## Constraints

- **Tech Stack**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui (new-york theme) | Node.js + Express.js + TypeScript + Mongoose | MongoDB 7 + Redis 7 (cache only) | Socket.IO | JWT via Passport.js | n8n self-hosted (Docker) — all non-negotiable
- **Infrastructure**: Docker Compose (mongo, redis, server, client, n8n, n8n_db postgres, nginx)
- **No queues in backend**: Redis is cache-only, no BullMQ, no in-process queues
- **No cron in backend**: n8n handles all scheduled/recurring tasks
- **No email in backend**: n8n handles all email dispatch
- **Validation**: Zod on all inputs
- **Pagination**: All list endpoints support page, limit, total
- **Audit**: All mutations create AuditLog entries
- **Dynamic fields**: Standard types only (text, number, date, dropdown, checkbox, file upload)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| n8n replaces all background processing | Single automation layer, no backend complexity for jobs/cron/email | — Pending |
| Fire-and-forget webhook pattern | n8n failures never break the app, decoupled architecture | — Pending |
| Same-app client portal (restricted views) | Simpler to build and maintain than separate portal, can split later | — Pending |
| Socket.IO rooms per programId | Scoped real-time updates, clients only see their program events | — Pending |
| Standard field types only for v1 | Keep dynamic fields manageable, add advanced types later if needed | — Pending |
| Redis cache-only (no queues) | n8n handles all async work, Redis stays simple | — Pending |

---
*Last updated: 2026-02-20 after initialization*
