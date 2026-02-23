---
phase: 09-due-dates-reminders
plan: 03
subsystem: n8n-workflows
tags: [n8n, workflow, reminders, due-dates, email, notifications]

# Dependency graph
requires:
  - phase: 09-due-dates-reminders
    plan: 01
    provides: "dueDate-based pending-reminders internal API (overdue + upcoming)"
  - phase: 05-n8n-integration-notifications
    provides: "Internal API with notifications endpoint, internalAuth middleware, notification model"
provides:
  - "Importable n8n workflow JSON for due-date-based reminder notifications"
  - "Schedule-triggered daily workflow fetching overdue and upcoming requests"
  - "HTML email reminders with overdue/upcoming styling and request links"
  - "In-app notification creation via internal API for each reminder"
affects: [n8n-configuration, email-delivery, notification-system]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "n8n workflow JSON template: importable via n8n UI with placeholder SMTP credentials"
    - "Parallel HTTP fetch: Schedule Trigger fans out to two HTTP Request nodes simultaneously"
    - "Merge + Split pattern: combine parallel results then process per-item for email + notification"

key-files:
  created:
    - server/n8n-workflows/due-date-reminder-workflow.json
  modified: []

key-decisions:
  - "Workflow set active: false by default -- user must configure SMTP credentials before enabling"
  - "Schedule Trigger uses cron 0 8 * * * (daily 8AM) as configurable default"
  - "splitOut node used instead of splitInBatches for simpler per-item processing without batch overhead"
  - "Email subject dynamically switches between overdue and upcoming templates based on daysOverdue value"
  - "notification.model.ts already had 'reminder' type -- no model modification needed"

patterns-established:
  - "n8n workflow JSON template: self-contained importable workflow with env var placeholders"

requirements-completed: [DUE-04]

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 9 Plan 3: n8n Due Date Reminder Workflow Summary

**Importable n8n workflow JSON for daily due-date reminders with HTML email and in-app notification delivery**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T09:22:54Z
- **Completed:** 2026-02-23T09:24:57Z
- **Tasks:** 1
- **Files created:** 1

## Accomplishments
- Created complete n8n workflow JSON template with 7 nodes: Schedule Trigger, 2x HTTP Request (overdue/upcoming), Merge, Split, Email Send, HTTP Request (notification)
- Workflow fans out from schedule trigger to parallel overdue/upcoming API fetches, merges results, then processes each reminder individually
- HTML email template with dynamic overdue (red) and upcoming (amber) styling, request details, and app link placeholder
- In-app notification creation via POST to internal notifications API with "reminder" type

## Task Commits

Each task was committed atomically:

1. **Task 1: Create n8n due-date reminder workflow JSON** - `49882d7` (feat)

## Files Created/Modified
- `server/n8n-workflows/due-date-reminder-workflow.json` - Complete n8n workflow template for due-date-based reminder notifications (7 nodes, daily schedule, email + in-app notification)

## Decisions Made
- Workflow set to `active: false` by default so users must configure SMTP credentials in n8n credential manager before activation
- Schedule Trigger cron expression `0 8 * * *` (daily at 8AM) -- users can adjust in n8n UI after import
- Used `n8n-nodes-base.splitOut` instead of `splitInBatches` for simpler per-item processing without batch loop overhead
- Email subject dynamically switches template based on `daysOverdue > 0` (overdue vs upcoming)
- Confirmed `notification.model.ts` already includes "reminder" in NOTIFICATION_TYPES -- no model change required (added in prior phase)
- SMTP credentials use placeholder reference -- user configures actual credentials in n8n's credential manager

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
After importing the workflow into n8n:
1. Configure SMTP credentials in n8n credential manager
2. Set `INTERNAL_API_KEY` environment variable in n8n to match the server's internal API key
3. Update `YOUR_APP_URL` placeholder in the email template HTML to the actual application URL
4. Enable the workflow (toggle active) once credentials are configured

## Next Phase Readiness
- n8n due-date reminder workflow complete -- ready for import and configuration
- Combined with Plan 01 (data layer) and Plan 02 (frontend), the full due dates and reminders feature set is deliverable
- Existing Phase 5 staleness-based workflow can be retired after this workflow is activated

## Self-Check: PASSED

- FOUND: server/n8n-workflows/due-date-reminder-workflow.json
- FOUND: commit 49882d7
- FOUND: 09-03-SUMMARY.md

---
*Phase: 09-due-dates-reminders*
*Completed: 2026-02-23*
