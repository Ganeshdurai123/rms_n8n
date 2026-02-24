---
phase: 12-reports-dashboard
status: testing
created: 2026-02-24
updated: 2026-02-24
---

# Phase 12: Reports & Dashboard — UAT

## Tests

### T1: Sidebar Reports navigation
**What to test:** Click "Reports" in the sidebar navigation
**Expected:** Navigates to /reports page. Sidebar item shows chart icon and "Reports" label. Item is highlighted when active.
**Status:** pending
**Result:**

### T2: Reports page layout — generate cards
**What to test:** On /reports page, verify three report generation cards render
**Expected:** Three cards visible: "Summary Report" (with date range inputs), "Program Report" (with program dropdown + date inputs), "Overdue Report" (with optional program filter). Each has a "Generate" button.
**Status:** pending
**Result:**

### T3: Generate a Summary Report
**What to test:** On Reports page, optionally set a date range and click Generate on the Summary Report card
**Expected:** Toast appears "Report generation started". Report appears in the list below with status badge showing pending/processing. Status updates to completed after n8n processes it (or stays pending if n8n is not running).
**Status:** pending
**Result:**

### T4: Generate a Program Report
**What to test:** Select a program from the dropdown on the Program Report card and click Generate
**Expected:** Toast confirms generation started. New report appears in list with "program" type badge (blue).
**Status:** pending
**Result:**

### T5: Generate an Overdue Report
**What to test:** Click Generate on the Overdue Report card (optionally filter by program)
**Expected:** Toast confirms generation started. New report appears in list with "overdue" type badge (orange).
**Status:** pending
**Result:**

### T6: Report list — pagination and status badges
**What to test:** With multiple reports generated, verify the list table renders correctly
**Expected:** Table shows columns: Type (colored badge), Status (colored badge — gray/blue/green/red), Requested (relative time), Completed (time or '-'). Pagination works if > page limit.
**Status:** pending
**Result:**

### T7: Report list — auto-refresh
**What to test:** Generate a report and watch the list while the report processes
**Expected:** List auto-refreshes (every 10 seconds or immediately on socket event) — status badge updates from pending to processing to completed without manual page refresh.
**Status:** pending
**Result:**

### T8: View completed Summary Report detail
**What to test:** Click on a completed Summary Report in the list
**Expected:** Navigates to /reports/:reportId. Shows report metadata (type badge, dates, requester). Renders three sections: "By Status" (horizontal bar chart), "By Program" (bar chart), "By Month" (list/table). Total request count at top.
**Status:** pending
**Result:**

### T9: View completed Program Report detail
**What to test:** Click on a completed Program Report in the list
**Expected:** Shows program name heading, "Status Breakdown" bar chart, "Average Lifecycle" metric card (days or N/A), "Field Distributions" section with sub-charts per field.
**Status:** pending
**Result:**

### T10: View completed Overdue Report detail
**What to test:** Click on a completed Overdue Report in the list
**Expected:** Shows "Overdue Requests" heading with total count. Table with columns: Title, Program, Status badge, Due Date, Days Overdue (red), Assigned To, Created By. Sorted by days overdue descending.
**Status:** pending
**Result:**

### T11: Report detail — pending/failed states
**What to test:** Click on a pending/processing report (if reachable by URL), or view a failed report
**Expected:** Pending shows spinner with "Report is being generated..." message. Failed shows error message with red styling. Back navigation available in all states.
**Status:** pending
**Result:**

### T12: Back navigation from report detail
**What to test:** From any report detail page, click the back button
**Expected:** Returns to /reports list page. Report list is still populated with correct data.
**Status:** pending
**Result:**

## Gaps
