---
phase: 05-n8n-integration-notifications
plan: 04
subsystem: api
tags: [n8n, workflow, email, smtp, scheduled-reminders, internal-api, webhook]

# Dependency graph
requires:
  - phase: 05-n8n-integration-notifications
    provides: Webhook outbox, typed event catalog, internal API with shared-secret auth (05-01)
  - phase: 05-n8n-integration-notifications
    provides: Notification model, createNotificationFromInternal service, real-time Socket.IO delivery (05-02)
provides:
  - n8n workflow template for webhook-triggered email notifications (status changes, assignments, comments)
  - n8n workflow template for scheduled daily reminder checks on stale requests
  - Internal API endpoint for n8n to create in-app notifications after email dispatch
  - Internal API endpoint for n8n to fetch stale requests needing reminder emails
  - Setup documentation for importing and configuring n8n workflows
affects: [06-sheet-views, 08-client-collaboration]

# Tech tracking
tech-stack:
  added: []
  patterns: [n8n-workflow-templates, webhook-callback-loop, scheduled-reminder-pattern]

key-files:
  created:
    - n8n/workflows/email-notification.json
    - n8n/workflows/scheduled-reminder.json
    - n8n/README.md
  modified:
    - server/src/modules/internal/internal.controller.ts
    - server/src/modules/internal/internal.routes.ts

key-decisions:
  - "n8n workflow JSONs are importable templates with placeholder SMTP credentials -- user configures in n8n credential manager"
  - "getPendingReminders uses 48-hour staleness threshold for submitted/in_review requests, limited to 100 results"
  - "createNotificationHandler validates notification type against NOTIFICATION_TYPES enum to reject invalid types from n8n"
  - "Scheduled reminder workflow uses splitOut node (not SplitInBatches) for cleaner per-item processing in n8n v1+"
  - "Both workflows set active: false by default so users must configure SMTP before activation"

patterns-established:
  - "n8n callback loop: Express webhook outbox -> n8n workflow -> email send -> internal API callback -> in-app notification"
  - "Scheduled workflow pattern: n8n Schedule Trigger -> fetch data from internal API -> process items -> email + notification"

requirements-completed: [N8N-06, N8N-07, NOTIF-03]

# Metrics
duration: 7min
completed: 2026-02-22
---

# Phase 5 Plan 4: n8n Workflow Templates and Internal API Callbacks Summary

**n8n workflow templates for webhook-triggered email dispatch (status changes, assignments, comments) and daily scheduled reminder checks, with internal API callback endpoints for in-app notification creation**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-22T14:40:47Z
- **Completed:** 2026-02-22T14:48:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Internal API expanded with createNotificationHandler (POST /notifications) and getPendingReminders (GET /pending-reminders), both secured by shared-secret auth
- Email notification workflow template handles 3 event types via Switch node routing, sends SMTP email, then calls back to create in-app notification
- Scheduled reminder workflow runs daily, fetches stale requests (48h+ in submitted/in_review), sends reminder emails with request details
- Complete n8n README with import instructions, environment variable reference, and customization guide
- All email dispatch delegated to n8n -- zero nodemailer/SMTP code in Express, zero cron jobs

## Task Commits

Each task was committed atomically:

1. **Task 1: Internal API endpoints for n8n callbacks (notifications + reminders)** - `499078c` (feat)
2. **Task 2: n8n workflow JSON templates and setup documentation** - `8c751c7` (feat)

## Files Created/Modified
- `server/src/modules/internal/internal.controller.ts` - Added createNotificationHandler and getPendingReminders handlers with inline validation
- `server/src/modules/internal/internal.routes.ts` - Added POST /notifications and GET /pending-reminders routes (4 routes total now)
- `n8n/workflows/email-notification.json` - 9-node n8n workflow: Webhook Trigger -> Switch -> Email Send (x3) -> HTTP Request callbacks -> Respond
- `n8n/workflows/scheduled-reminder.json` - 7-node n8n workflow: Schedule Trigger -> Fetch -> If -> Split -> Email -> Notification callback
- `n8n/README.md` - Setup guide with prerequisites, import steps, env var table, workflow descriptions, customization instructions

## Decisions Made
- n8n workflow JSONs are importable templates with placeholder SMTP credentials (id: "CONFIGURE_ME") -- user must configure in n8n credential manager before activation
- getPendingReminders uses 48-hour staleness threshold for submitted/in_review requests, sorted by updatedAt ascending (oldest first), limited to 100 results
- createNotificationHandler validates notification type against the NOTIFICATION_TYPES enum array to reject invalid types early
- Used n8n splitOut node (v1) instead of deprecated SplitInBatches for cleaner per-item processing
- Both workflows default to active: false to prevent activation before SMTP is configured
- Email templates include "View Request" links using CLIENT_URL env var with fallback to localhost

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

n8n workflows require manual configuration before activation:
1. Configure SMTP credentials in n8n UI (Settings > Credentials > Add "SMTP Account")
2. Set INTERNAL_API_KEY as n8n environment variable (must match Express .env value)
3. Import workflow JSON files via n8n UI (Workflows > Import from File)
4. Select SMTP credentials in each Email Send node
5. Activate workflows when ready

See `n8n/README.md` for detailed step-by-step instructions.

## Next Phase Readiness
- Complete n8n integration loop: Express outbox -> n8n webhook -> email + internal API callback -> in-app notification
- Phase 5 n8n integration and notification system fully operational pending SMTP configuration
- Ready for Phase 6 (Sheet Views) and Phase 8 (Client Collaboration) which will leverage notifications

## Self-Check: PASSED

- All 5 files verified present on disk
- Commit 499078c (Task 1) verified in git log
- Commit 8c751c7 (Task 2) verified in git log
- TypeScript compilation passes with zero errors
- Both workflow JSONs are valid JSON with required node types
- Both workflows have active: false

---
*Phase: 05-n8n-integration-notifications*
*Completed: 2026-02-22*
