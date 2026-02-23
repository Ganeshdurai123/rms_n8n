---
phase: 09-due-dates-reminders
plan: 02
subsystem: ui
tags: [react, calendar, due-dates, badges, tailwind]

# Dependency graph
requires:
  - phase: 09-due-dates-reminders
    provides: "dueDate on RequestItem, dueBefore/dueAfter query params on request list API"
  - phase: 06-sheet-views
    provides: "SheetTable, SheetViewPage, Badge/UI components"
  - phase: 08-client-collaboration
    provides: "RequestInfo component, RequestDetailPage"
provides:
  - "Due Date column with overdue/due-soon badges in SheetTable"
  - "Due date display with color-coded indicator in RequestInfo"
  - "CalendarViewPage at /programs/:programId/calendar with month/week views"
  - "CalendarGrid component rendering requests by due date with status dots"
  - "useCalendarData hook fetching and grouping requests by date range"
  - "Calendar navigation button in SheetViewPage header"
affects: [09-due-dates-reminders]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional column rendering: due date column shown only when requests have dueDate values"
    - "Date range computation: month/week ranges with Monday-based week start for calendar grid"
    - "Request grouping by date key: Map<YYYY-MM-DD, RequestItem[]> for O(1) cell lookup"

key-files:
  created:
    - client/src/components/calendar/useCalendarData.ts
    - client/src/components/calendar/CalendarGrid.tsx
    - client/src/pages/CalendarViewPage.tsx
  modified:
    - client/src/components/sheet/SheetTable.tsx
    - client/src/components/request/RequestInfo.tsx
    - client/src/App.tsx
    - client/src/pages/SheetViewPage.tsx

key-decisions:
  - "Due Date column conditionally shown only when at least one request has a dueDate (programs without due dates see no column)"
  - "Three-tier indicator system: red (overdue), orange (due within 3 days), green (on-track, detail page only)"
  - "Calendar uses Monday-based weeks with month range extended to full weeks for grid alignment"
  - "Calendar button placed in SheetViewPage header (not sidebar) since no program-scoped sidebar nav exists"
  - "Calendar items limited to 3 visible per day cell in month view with +N more overflow indicator"

patterns-established:
  - "Conditional column: useMemo check on array data to conditionally render table columns"
  - "Calendar date range: getMonthRange/getWeekRange utilities for API query parameter computation"

requirements-completed: [DUE-02, DUE-03]

# Metrics
duration: 4min
completed: 2026-02-23
---

# Phase 9 Plan 2: Due Date UI Indicators and Calendar View Summary

**Due date column with overdue/due-soon badges in sheet view, due date display in request detail, and full calendar view page with month/week layouts**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-23T09:22:45Z
- **Completed:** 2026-02-23T09:26:16Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Sheet view table displays a sortable Due Date column with red (overdue) and orange (due-soon) badge indicators, conditionally hidden for programs without due dates
- Request detail info card shows due date with three-tier color-coded status badge (red/orange/green)
- Full calendar view page at /programs/:programId/calendar with month and week view modes, prev/next/today navigation, and clickable request items
- Calendar grid renders requests on their due dates with status-colored dots, today highlight, and overflow indicators

## Task Commits

Each task was committed atomically:

1. **Task 1: Due date column in sheet view + due date display in request detail** - `0b70c7f` (feat)
2. **Task 2: Calendar view page with month/week views** - `0ebde88` (feat)

## Files Created/Modified
- `client/src/components/calendar/useCalendarData.ts` - Custom hook fetching requests by date range, grouping by YYYY-MM-DD key
- `client/src/components/calendar/CalendarGrid.tsx` - Calendar grid component with day cells, status dots, overflow indicators
- `client/src/pages/CalendarViewPage.tsx` - Full page with month/week toggle, navigation controls, program name header
- `client/src/components/sheet/SheetTable.tsx` - Added sortable Due Date column with overdue/due-soon badges
- `client/src/components/request/RequestInfo.tsx` - Added due date display with three-tier color indicator
- `client/src/App.tsx` - Added route for /programs/:programId/calendar
- `client/src/pages/SheetViewPage.tsx` - Added Calendar button in header for navigation

## Decisions Made
- Due Date column conditionally shown only when at least one request has a dueDate value -- programs without due date config see no column clutter
- Three-tier indicator: red for overdue, orange for due within 3 days, green for on-track (green only on detail page since table uses null for distant dates)
- Calendar uses Monday-based weeks; month range extends to cover full weeks for clean grid alignment
- Calendar button placed in SheetViewPage header next to Activity button (not sidebar) since no program-scoped sidebar nav exists
- Calendar items limited to 3 per day cell in month view (6 in week view) with "+N more" overflow indicator

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Due date UI complete -- sheet view shows due date column, request detail shows due date, calendar view provides deadline planning
- Ready for Plan 03 (n8n reminder workflow updates if applicable)
- Programs without dueDateConfig enabled will not show due date column or calendar entries (graceful degradation)

## Self-Check: PASSED

All 7 files verified present. Both commit hashes (0b70c7f, 0ebde88) confirmed in git log.

---
*Phase: 09-due-dates-reminders*
*Completed: 2026-02-23*
