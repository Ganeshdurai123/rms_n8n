---
phase: 09-due-dates-reminders
verified: 2026-02-23T10:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 9: Due Dates & Reminders Verification Report

**Phase Goal:** Requests have configurable due dates with visual indicators, a calendar view for deadline planning, and automated reminders for upcoming/overdue items via n8n
**Verified:** 2026-02-23T10:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin/manager can configure due date rules (defaultOffsetDays, dueDateField) on a program via PATCH /programs/:programId | VERIFIED | `program.schema.ts` exports `dueDateConfigSchema` with `enabled`, `defaultOffsetDays`, `dueDateField` fields wired into both `createProgramSchema` and `updateProgramSchema`. Cross-reference refinement validates that `dueDateField` points to a `date`-type fieldDefinition. |
| 2 | When a request is created, a dueDate is computed from program rules and stored on the request document | VERIFIED | `request.service.ts` lines 112-127 define `computeDueDate(program, fields)`. Line 151 calls `computeDueDate(program, data.fields)` and line 162 passes `dueDate` to `Request.create()`. |
| 3 | Requests returned from list and detail APIs include the dueDate field | VERIFIED | `request.model.ts` line 37 defines `dueDate?: Date` on `IRequestDocument`. `client/src/lib/types.ts` line 59 defines `dueDate?: string` on `RequestItem`. `getRequests` and `getRequestById` both return the full document including `dueDate`. |
| 4 | The pending-reminders internal API returns requests based on actual dueDate (upcoming within 24h, overdue) rather than 48h staleness | VERIFIED | `internal.controller.ts` lines 189-211: overdue condition uses `{ dueDate: { $lt: now } }`, upcoming uses `{ dueDate: { $gte: now, $lte: in24h } }`. Response includes `dueDate` and `daysOverdue` fields (lines 244-245). Old staleness heuristic fully replaced. |
| 5 | sortBy=dueDate works on the list requests endpoint | VERIFIED | `request.schema.ts` line 95: `sortBy` enum includes `'dueDate'`. `request.service.ts` lines 348-350: dynamic sort block uses `sortBy` directly as the field name, so `dueDate` is passed as a valid sort key. |
| 6 | Sheet view table shows a 'Due Date' column with overdue/due-soon colored indicators | VERIFIED | `SheetTable.tsx` lines 115-124 define `getDueDateIndicator`. Lines 184-188: `hasDueDate` computed via `useMemo`. Lines 266-273: conditional `<TableHead>` for "Due Date" with sort. Lines 414-436: conditional `<TableCell>` rendering date + badge. |
| 7 | Request detail page shows the due date with overdue/due-soon visual indicators in the info card | VERIFIED | `RequestInfo.tsx` lines 50-58: `getDueDateIndicator` returns three-tier indicator (red/orange/green). Lines 136-152: conditional rendering when `request.dueDate` is defined, showing formatted date + colored badge. |
| 8 | User can navigate to a calendar view page from the SheetViewPage | VERIFIED | `SheetViewPage.tsx` imports `Calendar` from lucide-react (line 14) and renders a `<Button>` at line 255-262 that calls `navigate('/programs/${programId}/calendar')`. |
| 9 | Calendar view renders requests on their due dates in a month grid, color-coded by status; user can switch between month and week views | VERIFIED | `CalendarViewPage.tsx` wires `useCalendarData` to `CalendarGrid`. Month/week toggle buttons at lines 119-138 call `setViewMode`. `CalendarGrid.tsx` renders a 7-column grid with `DayCell` for each day, status-colored dots via `STATUS_DOT` map, today ring highlight, overflow "+N more". |
| 10 | n8n workflow JSON template exists, runs on a schedule, fetches overdue/upcoming from pending-reminders, sends emails, creates in-app notifications | VERIFIED | `server/n8n-workflows/due-date-reminder-workflow.json` is valid JSON (confirmed). Contains 7 nodes: `scheduleTrigger` (cron `0 8 * * *`), two `httpRequest` nodes hitting `pending-reminders?type=overdue` and `pending-reminders?type=upcoming`, `merge`, `splitOut`, `emailSend`, and `httpRequest` to POST `/internal/notifications`. `active: false` by default. |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/modules/program/program.model.ts` | `IDueDateConfig` interface and `dueDateConfig` subdocument on Program | VERIFIED | `IDueDateConfig` defined at lines 41-45. `dueDateConfig` embedded in `IProgramDocument` (line 64) and `programSchema` (lines 168-181) with `enabled`, `defaultOffsetDays`, `dueDateField` fields. |
| `server/src/modules/request/request.model.ts` | `dueDate` optional Date field with index | VERIFIED | `dueDate?: Date` at line 37. Schema entry at lines 100-104 with `index: true`. Compound index `{ programId: 1, dueDate: 1 }` at line 115. |
| `server/src/modules/request/request.service.ts` | `computeDueDate` helper, dueDate in createRequest, dueAfter/dueBefore in getRequests | VERIFIED | `computeDueDate` at lines 112-127. Called in `createRequest` at line 151. `dueAfter`/`dueBefore` filter block in `getRequests` at lines 306-315 and in `exportRequestsCsv` at lines 821-830 (bonus). |
| `server/src/modules/internal/internal.controller.ts` | `getPendingReminders` using dueDate-based overdue/upcoming queries | VERIFIED | Full rewrite at lines 165-265. Uses `$lt: now` for overdue and `$gte: now, $lte: in24h` for upcoming. Returns `dueDate` and `daysOverdue` in each reminder object. |
| `client/src/lib/types.ts` | `dueDate` on `RequestItem`, `dueDateConfig` on `Program` | VERIFIED | `dueDate?: string` on `RequestItem` at line 59. `dueDateConfig?: { enabled, defaultOffsetDays, dueDateField }` on `Program` at lines 40-44. |
| `client/src/components/sheet/SheetTable.tsx` | Due Date column with overdue/due-soon badges | VERIFIED | `getDueDateIndicator` helper (lines 115-124), `hasDueDate` conditional (lines 185-188), sortable `<TableHead>` (lines 266-273), `<TableCell>` with date and badge (lines 414-436). |
| `client/src/components/request/RequestInfo.tsx` | Due date display with visual indicators in request detail | VERIFIED | `getDueDateIndicator` with three-tier (red/orange/green) at lines 50-58. Conditional `dueDate` block at lines 136-152. |
| `client/src/pages/CalendarViewPage.tsx` | Calendar page with month/week toggle and navigation | VERIFIED | Full implementation: `useParams`, `viewDate`/`viewMode` state, program name fetch, prev/next/today navigation, month/week toggle buttons, `CalendarGrid` wired with `useCalendarData`. |
| `client/src/components/calendar/CalendarGrid.tsx` | Calendar grid rendering days with request items | VERIFIED | 7-column grid, `DayCell` per day, status dots via `STATUS_DOT`, today highlight (`ring-2 ring-primary`), out-of-month dimming (`opacity-50`), overflow "+N more". |
| `client/src/components/calendar/useCalendarData.ts` | Hook fetching requests by due date range | VERIFIED | `getMonthRange`/`getWeekRange` utilities, `api.get('/programs/${programId}/requests', { params: { dueAfter, dueBefore, limit: 200 } })`, `requestsByDate` Map grouping by `YYYY-MM-DD` key. |
| `client/src/App.tsx` | Route for calendar view page | VERIFIED | `import { CalendarViewPage }` at line 11. Route `/programs/:programId/calendar` at lines 27-29. |
| `server/n8n-workflows/due-date-reminder-workflow.json` | Importable n8n workflow for due-date-based reminders | VERIFIED | Valid JSON. Contains `pending-reminders` URL references. 7-node workflow. `active: false`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `request.service.ts` | `program.model.ts` | `getProgramById` reading `dueDateConfig` in `computeDueDate` | WIRED | `program.dueDateConfig?.enabled` at line 113; `program.dueDateConfig.dueDateField` at line 116; `program.dueDateConfig.defaultOffsetDays` at line 125. |
| `internal.controller.ts` | `request.model.ts` | Query on `dueDate` field with `$lt`/`$lte` | WIRED | `dueDate: { $lt: now }` at line 190; `dueDate: { $gte: now, $lte: in24h }` at line 195. Query executes via `RequestModel.find(typeFilter)` at line 213. |
| `CalendarViewPage.tsx` | `/api/v1/programs/:programId/requests` | `useCalendarData` hook with `dueBefore`/`dueAfter` params | WIRED | `useCalendarData.ts` line 86-88: `params = { dueAfter: dateRange.start.toISOString(), dueBefore: dateRange.end.toISOString(), limit: 200 }`. Used in `api.get(...)` at line 90. |
| `SheetTable.tsx` | `types.ts` | `RequestItem.dueDate` for column rendering | WIRED | `req.dueDate` accessed at lines 186, 416, 420 in `SheetTable.tsx`. |
| `App.tsx` | `CalendarViewPage.tsx` | React Router route definition | WIRED | `import { CalendarViewPage }` at line 11; route element at line 28. |
| `due-date-reminder-workflow.json` | `internal.controller.ts` | HTTP Request node calling GET `/api/v1/internal/pending-reminders` | WIRED | Two HTTP Request nodes with URLs `http://server:5000/api/v1/internal/pending-reminders?type=overdue` and `?type=upcoming`. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DUE-01 | 09-01 | Admin/manager can configure due date rules per program (default offset, field-level overrides) | SATISFIED | `program.model.ts` + `program.schema.ts` define `dueDateConfig` with `enabled`, `defaultOffsetDays`, `dueDateField`. Schema includes cross-reference refinement validating `dueDateField` must point to a `date`-type field definition. Update schema (`updateProgramSchema`) allows partial `dueDateConfig` updates. |
| DUE-02 | 09-01, 09-02 | Requests display due dates based on program rules (sheet column + request detail) | SATISFIED | `computeDueDate` stores `dueDate` at creation. `SheetTable.tsx` renders sortable "Due Date" column with overdue/due-soon badges. `RequestInfo.tsx` renders due date with three-tier color indicator. Both degrade gracefully when `dueDate` is undefined. |
| DUE-03 | 09-02 | User can view requests in a calendar view (month/week, color-coded by status) | SATISFIED | `CalendarViewPage.tsx` at route `/programs/:programId/calendar` provides month/week toggle, prev/next/today navigation. `CalendarGrid.tsx` renders status-colored dots per request per day. Calendar button in `SheetViewPage.tsx` header provides navigation. |
| DUE-04 | 09-01, 09-03 | Reminder rules stored in DB, n8n reads and sends reminders for upcoming/overdue deadlines | SATISFIED | `dueDate` stored on Request model (DB). `internal.controller.ts` `getPendingReminders` queries by actual `dueDate` for overdue (`$lt: now`) and upcoming (`$lte: in24h`). `due-date-reminder-workflow.json` is an importable n8n workflow that calls this API, sends HTML emails, and creates in-app notifications via internal API. `NOTIFICATION_TYPES` includes `'reminder'`. |

All four requirement IDs from the plan frontmatter are accounted for. No orphaned requirements detected — REQUIREMENTS.md maps DUE-01 through DUE-04 to Phase 9, and all four are covered.

---

### Anti-Patterns Found

No blockers or stub patterns detected across all phase-09 artifacts.

The following were evaluated and confirmed benign:
- `return null` in `getDueDateIndicator` (SheetTable.tsx lines 116, 123, 421): Legitimate — returns `null` when no indicator is needed for distant due dates. This is intentional conditional logic, not a stub.
- `placeholder` in `program.model.ts` and `types.ts`: Legitimate — refers to the `placeholder` property on dynamic field definitions (text input hint), not a code placeholder.

---

### Human Verification Required

The following behaviors require human testing and cannot be verified programmatically:

#### 1. Due Date Visual Indicators in Sheet View

**Test:** Open a program with `dueDateConfig.enabled = true`. Create a request that is overdue (dueDate in the past) and one due within 3 days. Open the sheet view.
**Expected:** "Due Date" column is visible. Overdue request shows red badge (e.g., "5d overdue"). Due-soon request shows orange badge (e.g., "Due in 2d"). A request with a far-future dueDate shows only the formatted date with no badge.
**Why human:** Badge rendering with dynamic date arithmetic cannot be asserted without DOM rendering and live clock.

#### 2. Due Date Indicator in Request Detail

**Test:** Open the detail page for an overdue request, a due-soon request, and an on-track request.
**Expected:** Overdue shows red badge, due-soon shows orange badge, on-track shows green badge. Programs without `dueDateConfig.enabled = true` show no "Due Date" row.
**Why human:** Three-tier color logic requires visual inspection.

#### 3. Calendar Month View Rendering

**Test:** Navigate to `/programs/:programId/calendar`. Verify requests appear on their due-date cells. Verify today's cell has a distinct ring. Verify days outside the current month are dimmed. Verify "+N more" overflow shows for days with more than 3 requests.
**Expected:** All layout and color behaviors are correct.
**Why human:** CSS grid layout, ring styling, and overflow indicator require visual/browser inspection.

#### 4. Calendar Navigation and Week View

**Test:** Click "Previous" and "Next" to navigate months/weeks. Click "Today" to return to current date. Toggle between Month and Week views.
**Expected:** View date updates correctly, calendar re-fetches requests for the new range, week view shows one row of 7 taller cells.
**Why human:** State transitions and re-fetch behavior require interactive testing.

#### 5. n8n Workflow Import and Execution

**Test:** Import `server/n8n-workflows/due-date-reminder-workflow.json` into n8n. Configure SMTP credentials and `INTERNAL_API_KEY`. Enable the workflow and trigger it manually.
**Expected:** Workflow fetches overdue and upcoming requests, sends HTML reminder emails to assignees/creators, and creates in-app notifications via the internal API.
**Why human:** Requires live n8n instance, SMTP server, and running application server.

---

### Gaps Summary

No gaps. All 10 observable truths are verified, all 12 required artifacts exist and are substantive and wired, all 6 key links are confirmed connected, and all 4 requirement IDs (DUE-01, DUE-02, DUE-03, DUE-04) are satisfied.

The phase goal is fully achieved at the code level. Five items are flagged for human verification (visual indicators, calendar rendering, n8n execution) — these are expected and appropriate for UI/integration features.

---

_Verified: 2026-02-23T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
