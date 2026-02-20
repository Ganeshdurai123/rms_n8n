# Feature Research

**Domain:** Request Management System (internal operations + client collaboration, n8n-automated)
**Researched:** 2026-02-20
**Confidence:** MEDIUM (based on domain expertise of Jira Service Management, ServiceNow, Freshservice, Monday.com, Zendesk, Asana, and similar platforms; no live web verification available)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete. Every competitor has these.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Authentication + RBAC** | Users expect secure login, role-based access. Every SaaS product has this. Without it, the system is unusable. | MEDIUM | JWT (access 15min + refresh 7d), 4 roles (admin/manager/team_member/client). Passport.js. Must handle token refresh seamlessly. |
| **Request CRUD with full lifecycle** | The core verb of the system. Users must create, view, edit, and track requests through states (draft -> submitted -> in_review -> approved/rejected -> completed). | MEDIUM | State machine pattern. Every transition needs validation rules (who can transition, from which state). Audit log on every mutation. |
| **Configurable programs (organizational units)** | Teams need to organize requests by context — project, department, client. Without programs, everything is a flat list. | HIGH | Dynamic field configuration per program, boundary rules, permissions. This is the "schema builder" and the hardest table-stakes feature. |
| **Tabular sheet views** | Every request tracker presents data in table/list form. Users expect sortable, filterable columns. This is how people scan and manage work. | MEDIUM | Dynamic columns driven by program config. Inline editing, pagination, column reordering. Needs to feel snappy with 100+ rows. |
| **Search and filtering** | Users expect to find requests by keyword, status, assignee, date range, custom fields. Without this, the system is useless at scale. | MEDIUM | Full-text search on request titles/descriptions + field-level filtering. MongoDB text indexes or Atlas Search. |
| **Request comments and activity history** | Every ticketing/request system has threaded comments and a timeline of changes. Users expect to see who did what and when. | LOW-MEDIUM | Comments with @mentions (optional for v1), activity feed showing state changes, field edits, assignments. |
| **File attachments** | Users need to attach documents, screenshots, spreadsheets to requests. Universal expectation. | MEDIUM | Upload to local storage or S3-compatible. File type validation, size limits. Preview for images/PDFs is nice-to-have. |
| **Email notifications** | Users expect to be notified of assignments, status changes, comments. Without email, users must live in the app. | LOW (via n8n) | n8n handles all email dispatch. Fire-and-forget webhook from Express. Templates for each event type. |
| **In-app notifications** | Real-time bell icon with unread count. Users expect immediate awareness of changes relevant to them. | MEDIUM | Socket.IO for real-time push. Notification model in MongoDB. Read/unread state. |
| **CSV/Excel export** | Users expect to export filtered data to spreadsheets for reporting, sharing with stakeholders who don't use the system. | LOW | Server-side CSV generation. Export the current sheet view with applied filters. |
| **Audit trail** | Managers and admins expect to see who changed what and when. Required for compliance in many orgs. | LOW-MEDIUM | AuditLog collection. Every mutation creates an entry. Viewable per-request and system-wide (admin). |
| **User management (admin)** | Admins expect to invite users, assign roles, deactivate accounts. | LOW | CRUD on users. Role assignment. Invite flow (email via n8n). |
| **Responsive web UI** | Users expect the system to work on tablets and laptops. Not necessarily mobile-optimized, but not broken on smaller screens. | MEDIUM | Tailwind CSS handles this well. Main concern is the sheet/table view on narrow screens. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but provide significant value. These are where RMS can win against spreadsheets and generic tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **n8n-powered automation (visible workflows)** | Unlike black-box automation in Jira/ServiceNow, users can see and modify n8n workflows. Self-hosted = full control. No per-seat automation pricing. This is the killer differentiator. | HIGH | Requires well-designed webhook integration pattern. n8n workflows for: status changes, reminders, escalations, SLA alerts, report generation. The "automation is visible and editable" narrative is compelling. |
| **Request books (bulk CSV/Excel import with field mapping)** | Most request systems assume requests are created one-by-one. Bulk import from existing spreadsheets solves the migration problem AND ongoing bulk-entry workflows. Very few competitors do this well. | HIGH | Field mapping UI, validation preview, error handling, batch insert. This is a significant feature that solves a real pain point (migrating from spreadsheets). |
| **Client collaboration (same-app restricted portal)** | External clients submit and track their own requests without separate portal infrastructure. Clients see only their program's data. Simpler than Jira's customer portal, more capable than email. | MEDIUM-HIGH | Role-based view filtering. Client sees: their requests, activity feed, comments, file uploads. Does NOT see: other programs, admin settings, internal-only fields. The "same app, restricted view" approach is simpler to maintain than a separate portal. |
| **Program-level dynamic field configuration** | Each program defines its own fields (text, number, date, dropdown, checkbox, file upload). This means the system adapts to any request type without code changes. Monday.com charges premium for this. | HIGH | Already scoped in PROJECT.md. The key differentiator is that field config is per-program, so different teams can have completely different request schemas. |
| **Real-time collaboration (Socket.IO rooms per program)** | Live updates when teammates change requests. No need to refresh. Most lightweight request tools don't have this. | MEDIUM | Socket.IO rooms scoped by programId. Emit on every mutation. Handle reconnection gracefully. |
| **n8n-driven scheduled reminders and escalations** | Automated "this request is overdue" or "pending approval for 48h" nudges without any cron job code in the backend. The n8n GUI makes these configurable by admins. | MEDIUM | n8n scheduled workflows that query MongoDB directly or call Express API. Configurable thresholds per program. |
| **Due dates with calendar view (v2)** | Visual calendar of upcoming and overdue requests. Managers get a time-based view instead of just a list. Most request trackers lack a proper calendar. | MEDIUM | Calendar UI component (e.g., FullCalendar or custom). Due date rules per program. Color coding by status/priority. |
| **Async report generation via n8n (v2)** | Reports (summary, program-level, overdue) generated asynchronously by n8n, not blocking the Express server. Can handle heavy aggregation without API timeouts. | MEDIUM | n8n workflow triggered by webhook. Aggregates data, generates report (PDF/CSV), stores result, notifies user. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create significant complexity, maintenance burden, or user confusion. Deliberately NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Separate client portal (different app/domain)** | "Clients need their own branded experience" | Two codebases to maintain, two deployments, session management across apps, feature parity drift. Massive complexity for marginal UX gain. | Same app with role-based restricted views. Client role sees only their program(s), their requests, and collaboration features. Can split later if truly needed. |
| **In-process job queues (BullMQ/Redis queues)** | "We need reliable background processing" | Adds operational complexity (queue monitoring, retry logic, dead letter queues, worker scaling) inside the Node.js app. | n8n handles ALL async work. Fire-and-forget webhooks. n8n has its own retry/error handling. Redis stays cache-only. |
| **Backend cron jobs (node-cron)** | "We need scheduled tasks for reminders, cleanup" | Cron in Node.js is fragile (no persistence, no cluster-awareness, no visibility). | n8n handles all scheduled tasks with a GUI, logging, and retry logic. |
| **Backend email sending (nodemailer)** | "Just send emails directly from Express" | Template management in code, SMTP config in backend, error handling for delivery failures, no visibility into email history. | n8n sends all emails. Email templates managed in n8n. Full send history visible in n8n execution log. |
| **Conditional/calculated fields** | "Fields should change based on other field values" | Exponential complexity in the dynamic field engine. Validation becomes recursive. UI becomes a form builder. | Standard field types only for v1 (text, number, date, dropdown, checkbox, file upload). Add conditional logic in v2+ only if validated by real user demand. |
| **Kanban/board view** | "Let us drag cards between columns" | High implementation cost for drag-and-drop, state management, column configuration. Competes with the sheet view for attention. | Sheet (table) view is the primary interface. Kanban can be a v2+ consideration if users request it, but the table view is the natural fit for request management (more data density). |
| **Real-time collaborative editing (Google Docs style)** | "Multiple people editing the same request simultaneously" | Operational transform or CRDT algorithms, conflict resolution, cursor presence. Massive engineering effort. | Optimistic locking (last-write-wins with conflict notification). Socket.IO notifies when someone else is editing. "Someone else modified this request" warning. |
| **Custom workflow builder (visual state machine editor)** | "Let admins design their own approval workflows" | Building a visual workflow designer is a product unto itself. Execution engine, error handling, rollback logic. Months of work. | Fixed lifecycle (draft -> submitted -> in_review -> approved/rejected -> completed). n8n handles automation around transitions. If custom workflows are truly needed later, n8n IS the workflow builder. |
| **Native mobile app** | "People want to approve requests on their phone" | Two more codebases (iOS/Android) or React Native complexity. Push notifications, offline support, app store management. | Responsive web app. PWA-capable if needed (add to home screen, basic offline). Mobile-friendly approval actions. |
| **Multi-tenancy (SaaS model)** | "Let multiple organizations use the same instance" | Database isolation, billing, tenant-scoping on every query, subdomain routing. Architectural change that touches everything. | Single-tenant deployment. Each organization runs their own Docker Compose stack. Revisit only if going SaaS. |
| **AI-powered request routing/classification** | "Auto-assign requests based on content" | LLM integration, training data, accuracy concerns, user trust issues. Premature optimization. | Manual assignment by managers. n8n could integrate an LLM later via HTTP node if demand is validated. |
| **Granular field-level permissions** | "This field should be visible to managers but not clients" | Exponential permission matrix (roles x fields x programs). UI complexity for configuration. Hard to debug. | Program-level permissions (who can access the program). Client role sees all fields in their program. Use "internal notes" (comments marked as internal) for manager-only content. |

## Feature Dependencies

```
[Auth + RBAC]
    |
    +--requires--> [User Management]
    |
    +--enables--> [Programs + Sheets]
    |                  |
    |                  +--enables--> [Dynamic Fields]
    |                  |                  |
    |                  |                  +--enables--> [Request Lifecycle]
    |                  |                                    |
    |                  |                                    +--enables--> [Comments + Attachments]
    |                  |                                    |
    |                  |                                    +--enables--> [Request Books (CSV Import)]
    |                  |                                    |
    |                  |                                    +--enables--> [Due Dates + Calendar (v2)]
    |                  |
    |                  +--enables--> [Client Collaboration]
    |
    +--enables--> [n8n Webhook Integration]
                       |
                       +--enables--> [Email Notifications]
                       |
                       +--enables--> [In-App Notifications (via internal socket endpoint)]
                       |
                       +--enables--> [Scheduled Reminders / Escalations]
                       |
                       +--enables--> [Async Report Generation (v2)]

[Socket.IO] --enhances--> [In-App Notifications]
[Socket.IO] --enhances--> [Real-time Sheet Updates]
[Socket.IO] --enhances--> [Client Collaboration Activity Feed]

[Request Lifecycle] + [Due Dates] --enables--> [Reports (v2)]

[Search + Filtering] --enhances--> [Sheets]
[CSV Export] --enhances--> [Sheets]
```

### Dependency Notes

- **Auth + RBAC is the absolute foundation:** Nothing works without authenticated users and role checks. Must be phase 1.
- **Programs require Auth:** Program permissions reference roles. Dynamic fields are scoped to programs. Programs must exist before requests.
- **Request lifecycle requires Programs + Dynamic Fields:** Requests belong to programs and use program-defined fields. The field engine must work before requests can be created.
- **Request Books require Request lifecycle:** Bulk import creates requests, so the request creation pipeline must be solid first.
- **n8n integration is a parallel foundation:** Can be developed alongside Auth/Programs. Webhook endpoints + n8n workflow design. Must be ready before notifications.
- **Client Collaboration requires Programs + Request lifecycle:** Clients interact with requests within programs. The restricted-view logic layers on top of existing RBAC.
- **Notifications (email + in-app) require n8n integration:** n8n dispatches emails and triggers the internal socket endpoint for in-app notifications.
- **Due Dates + Calendar (v2) require Request lifecycle:** Due dates are a property of requests. Calendar view reads request data.
- **Reports (v2) require Request lifecycle + n8n:** Reports aggregate request data and are generated asynchronously by n8n.
- **Search/Filtering and CSV Export enhance Sheets:** These are additive features on the sheet view. Can be added incrementally.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to replace the current spreadsheet + email workflow.

- [x] **Auth + RBAC (4 roles)** -- Without this, no one can use the system securely
- [x] **Program CRUD with dynamic field configuration** -- The organizational backbone; programs define everything
- [x] **Sheet views with inline row CRUD** -- The primary interface users interact with daily
- [x] **Request full lifecycle (draft through completed)** -- The core value proposition: tracked, auditable request flow
- [x] **Request comments + file attachments + history** -- Collaboration within requests replaces email threads
- [x] **n8n webhook integration (fire-and-forget pattern)** -- Foundation for all automation; must be in v1 or automation is bolted on later
- [x] **Email notifications via n8n** -- Users cannot live in the app 24/7; email keeps them informed
- [x] **In-app notifications via Socket.IO** -- Real-time awareness when users are in the app
- [x] **Client collaboration (restricted views)** -- External clients submitting requests is a core use case, not a nice-to-have
- [x] **Request books (CSV/Excel import)** -- Migration from spreadsheets is the onboarding story; without this, adoption is slow
- [x] **Search and filtering on sheets** -- Useless at scale without it; table stakes for any data table
- [x] **CSV export** -- Users will demand spreadsheet exports from day one
- [x] **Audit trail** -- Every mutation logged; non-negotiable for operational trust

### Add After Validation (v1.x)

Features to add once core is working and users provide feedback.

- [ ] **Advanced search (saved filters, cross-program search)** -- Add when users hit >100 requests per program
- [ ] **Bulk actions on sheet (bulk status change, bulk assignment)** -- Add when users complain about one-by-one operations
- [ ] **Request templates (pre-filled forms per request type)** -- Add when users create similar requests repeatedly
- [ ] **@mentions in comments with notification** -- Add when teams actively use comments for collaboration
- [ ] **Dashboard (personal overview: my requests, my approvals, overdue)** -- Add when users have enough data to need a summary view
- [ ] **Webhook configuration UI (admin can see/manage n8n webhooks)** -- Add when admins want visibility into automation

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Due dates with configurable rules per program** -- Already scoped for v2; requires date arithmetic and reminder workflows
- [ ] **Calendar view** -- Requires due dates to be meaningful
- [ ] **Reports (summary, program-level, overdue)** -- Already scoped for v2; async generation via n8n
- [ ] **Kanban/board view** -- Only if users actively request it; table view is the natural fit
- [ ] **API access for external integrations** -- Only if third-party tools need to push/pull requests
- [ ] **SSO (SAML/OIDC)** -- Only if enterprise customers require it
- [ ] **Conditional fields / field logic** -- Only if standard field types prove insufficient

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auth + RBAC | HIGH | MEDIUM | P1 |
| Programs + Dynamic Fields | HIGH | HIGH | P1 |
| Sheet Views (tabular CRUD) | HIGH | MEDIUM | P1 |
| Request Lifecycle (state machine) | HIGH | MEDIUM | P1 |
| Comments + Attachments + History | HIGH | LOW-MEDIUM | P1 |
| n8n Webhook Integration | HIGH | MEDIUM | P1 |
| Email Notifications (via n8n) | HIGH | LOW | P1 |
| In-App Notifications + Socket.IO | MEDIUM-HIGH | MEDIUM | P1 |
| Client Collaboration (restricted views) | HIGH | MEDIUM-HIGH | P1 |
| Request Books (CSV/Excel import) | HIGH | HIGH | P1 |
| Search + Filtering | HIGH | MEDIUM | P1 |
| CSV Export | MEDIUM | LOW | P1 |
| Audit Trail | MEDIUM-HIGH | LOW | P1 |
| Bulk Actions | MEDIUM | MEDIUM | P2 |
| Dashboard (personal overview) | MEDIUM | MEDIUM | P2 |
| Request Templates | MEDIUM | LOW-MEDIUM | P2 |
| @Mentions in Comments | LOW-MEDIUM | LOW | P2 |
| Due Dates + Rules | MEDIUM-HIGH | MEDIUM | P2 (v2) |
| Calendar View | MEDIUM | MEDIUM | P2 (v2) |
| Reports (async via n8n) | MEDIUM-HIGH | MEDIUM | P2 (v2) |
| Saved Filters | MEDIUM | LOW | P2 |
| Kanban View | LOW-MEDIUM | HIGH | P3 |
| SSO (SAML/OIDC) | LOW (unless enterprise) | HIGH | P3 |
| API for External Integrations | LOW | MEDIUM | P3 |
| Conditional Fields | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (v1)
- P2: Should have, add when possible (v1.x or v2)
- P3: Nice to have, future consideration (v2+)

## Competitor Feature Analysis

| Feature | Jira Service Management | Monday.com | Freshservice | ServiceNow | Our Approach (RMS) |
|---------|------------------------|------------|--------------|------------|-------------------|
| Request lifecycle / states | Highly configurable workflow engine with conditions, validators, post-functions | Basic status columns, custom automations | Pre-built ITIL workflows, customizable | Enterprise workflow engine (extremely powerful, extremely complex) | Fixed 5-state lifecycle (draft/submitted/in_review/approved-rejected/completed). Simpler is better for v1. n8n handles automation around transitions. |
| Custom/dynamic fields | Yes, per project. Admin-configured. | Yes, column types per board. | Yes, per ticket type. | Yes, extremely granular. | Yes, per program. 6 standard types. No conditional logic in v1. |
| Client/external portal | Separate customer portal with branding | External form submissions, guest access | Self-service portal with knowledge base | Full self-service portal | Same app, restricted views for client role. Simpler infra, same capabilities. |
| Bulk import | CSV import available but basic | Excel import with column mapping | CSV import for assets/tickets | Import sets with transform maps | Request Books: Excel/CSV import with field mapping UI, validation preview, batch insert. Designed as a first-class feature, not an afterthought. |
| Automation | Jira Automation (rule builder, limited free tier) | Monday automations (recipe-based, paid tiers) | Workflow Automator | Flow Designer (enterprise) | n8n (self-hosted, unlimited, visual, editable by admins). No per-seat automation costs. Full visibility into workflow execution. This is the key differentiator. |
| Real-time updates | Limited (page refresh for most changes) | Real-time board updates | Limited | Limited | Socket.IO rooms per program. Live updates on every mutation. |
| Reporting | Built-in dashboards + JQL | Chart/dashboard widgets per board | Built-in ITIL reports + analytics | Powerful reporting engine | Async report generation via n8n (v2). Summary, program-level, overdue reports. |
| Email notifications | Yes, highly configurable | Yes, per-automation | Yes, per workflow step | Yes, extremely configurable | n8n-driven. Templates in n8n. Full send history in n8n execution log. |
| Calendar view | Via JQL + third-party | Timeline view (paid) | Not standard | Available via modules | Due dates + calendar view in v2. |
| Pricing model | Per-agent (expensive at scale) | Per-seat (expensive at scale) | Per-agent | Per-agent (very expensive) | Self-hosted. No per-seat costs. Pay only for infrastructure. |

### Key Competitive Insights

1. **n8n as automation layer is the strongest differentiator.** Every competitor charges per-seat for automation or limits it to paid tiers. Self-hosted n8n = unlimited automation with full visibility.

2. **Request Books (bulk import) is underserved.** Most competitors treat CSV import as an afterthought. Making it a first-class feature with field mapping, validation preview, and error handling is a real competitive advantage for teams migrating from spreadsheets.

3. **Same-app client portal is pragmatic.** Competitors like Jira and Freshservice build separate portal infrastructure. The "same app, restricted views" approach is faster to build and easier to maintain. It can always be split later if branding demands require it.

4. **Fixed lifecycle is a feature, not a limitation.** ServiceNow and Jira's workflow configurability is powerful but creates analysis paralysis and admin burden. A well-designed fixed lifecycle with n8n automation around transitions is simpler to understand and operate.

5. **Self-hosted = no vendor lock-in.** Docker Compose deployment means organizations own their data and infrastructure. This matters for security-conscious teams.

## Sources

- Domain knowledge of Jira Service Management, ServiceNow, Freshservice, Monday.com, Zendesk, Asana request management capabilities (MEDIUM confidence -- based on training data, not live verification)
- PROJECT.md project requirements and constraints (HIGH confidence -- primary source)
- General enterprise request management / ITSM feature patterns (MEDIUM confidence)

**Note:** WebSearch and WebFetch were unavailable during this research session. All competitive analysis is based on training data (knowledge cutoff May 2025). Feature sets of competitor products may have changed. Recommend validating specific competitor claims before using them in marketing or sales materials.

---
*Feature research for: Request Management System with n8n automation*
*Researched: 2026-02-20*
