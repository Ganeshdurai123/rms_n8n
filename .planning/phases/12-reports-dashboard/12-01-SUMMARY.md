---
phase: 12-reports-dashboard
plan: 01
subsystem: api
tags: [mongodb-aggregation, reports, n8n, webhook, async-processing, mongoose]

# Dependency graph
requires:
  - phase: 03-request-lifecycle-audit
    provides: Request model with status, programId, dueDate, fields Map
  - phase: 05-n8n-integration-notifications
    provides: Webhook outbox pattern, internal API with shared-secret auth
provides:
  - ReportJob Mongoose model with type/status/params/result fields
  - Three aggregation services (summary, program, overdue)
  - REST API at /api/v1/reports for report generation and retrieval
  - Internal API endpoints for n8n report execution (report-data, report-complete)
  - n8n workflow JSON template for async report generation
affects: [12-reports-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [async-report-generation-via-n8n, webhook-trigger-for-on-demand-processing]

key-files:
  created:
    - server/src/modules/report/report.model.ts
    - server/src/modules/report/report.schema.ts
    - server/src/modules/report/report.service.ts
    - server/src/modules/report/report.controller.ts
    - server/src/modules/report/report.routes.ts
    - server/n8n-workflows/report-generation-workflow.json
  modified:
    - server/src/modules/webhook/webhook.types.ts
    - server/src/modules/internal/internal.controller.ts
    - server/src/modules/internal/internal.routes.ts
    - server/src/app.ts

key-decisions:
  - "Async report pipeline: user triggers -> outbox webhook -> n8n -> internal API aggregation -> store result -> socket notify user"
  - "Socket.IO user-targeted emission for report:completed via socket iteration (same pattern as notification service)"
  - "Program report uses $lookup for program name population in aggregation pipeline"
  - "Overdue report sorted by daysOverdue descending for attention prioritization"
  - "Average lifecycle computed from updatedAt-createdAt for completed requests (proxy for completion time)"

patterns-established:
  - "Async report generation: POST returns 202 + enqueues webhook, n8n handles heavy work"
  - "Internal API report-data/report-complete pattern for n8n aggregation callback"

requirements-completed: [RPT-01, RPT-02, RPT-03, RPT-04]

# Metrics
duration: 5min
completed: 2026-02-23
---

# Phase 12 Plan 01: Report Backend Infrastructure Summary

**Async report generation with MongoDB aggregations for summary/program/overdue reports via n8n webhook pipeline**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-23T14:10:09Z
- **Completed:** 2026-02-23T14:15:21Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- ReportJob Mongoose model with type/status/params/result fields and three indexes for query optimization
- Three aggregation functions: summary (by status/program/month), program (status breakdown, field distributions, avg lifecycle), overdue (past-due with days overdue)
- REST API at /api/v1/reports: POST returns 202 with webhook enqueue, GET lists reports with access scoping, GET/:id returns report with result
- Internal API endpoints for n8n: GET /report-data runs aggregation, POST /report-complete stores result and notifies user via Socket.IO
- n8n workflow template: webhook trigger -> fetch data -> complete report flow

## Task Commits

Each task was committed atomically:

1. **Task 1: ReportJob model, aggregation service, and report REST API** - `a2c1190` (feat)
2. **Task 2: Internal API endpoints for n8n report execution and n8n workflow template** - `4bc7d92` (feat)

## Files Created/Modified
- `server/src/modules/report/report.model.ts` - ReportJob Mongoose model with type, status, params, result, requestedBy fields
- `server/src/modules/report/report.schema.ts` - Zod schemas for create, list, and reportId param validation
- `server/src/modules/report/report.service.ts` - Report CRUD + three aggregation functions + complete/fail helpers
- `server/src/modules/report/report.controller.ts` - REST handlers: generateReport (202), listReports, getReport
- `server/src/modules/report/report.routes.ts` - Router with authenticate middleware, validation, pagination
- `server/n8n-workflows/report-generation-workflow.json` - n8n workflow: webhook -> fetch data -> complete report
- `server/src/modules/webhook/webhook.types.ts` - Added 'report.requested' to webhook event types
- `server/src/modules/internal/internal.controller.ts` - Added getReportData and completeReportHandler
- `server/src/modules/internal/internal.routes.ts` - Added /report-data and /report-complete routes
- `server/src/app.ts` - Mounted reportRouter at /api/v1/reports

## Decisions Made
- Async report pipeline: user triggers via POST (202 Accepted) -> outbox webhook -> n8n -> internal API aggregation -> store result -> socket notify
- Socket.IO user-targeted emission for report:completed via io.sockets.sockets iteration (consistent with notification service pattern from Phase 05)
- Program report field distributions only aggregate dropdown/checkbox field types (text/number/date not practical for distribution analysis)
- Average lifecycle duration uses updatedAt minus createdAt for completed requests as proxy for completion time
- Overdue report sorted by daysOverdue descending so most-overdue items surface first

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The n8n workflow JSON is an importable template (active: false by default).

## Next Phase Readiness
- Report backend infrastructure complete; ready for frontend dashboard (12-02)
- REST API and Socket.IO event provide all data interfaces needed for UI
- n8n workflow template ready for import and configuration

## Self-Check: PASSED

- All 6 created files verified on disk
- Commits a2c1190 and 4bc7d92 verified in git log
- TypeScript compilation: zero errors
- n8n workflow JSON: valid

---
*Phase: 12-reports-dashboard*
*Completed: 2026-02-23*
