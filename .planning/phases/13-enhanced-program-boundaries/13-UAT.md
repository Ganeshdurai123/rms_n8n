---
status: testing
phase: 13-enhanced-program-boundaries
source: [13-01-SUMMARY.md, 13-02-SUMMARY.md]
started: 2026-02-24
updated: 2026-02-24
---

## Current Test

number: 1
name: Configure per-user active request limit on a program
expected: |
  In program settings (create or edit), you can set a "Max Active Requests Per User" field.
  It accepts a positive integer (min 1). Saving the program stores this value.
awaiting: user response

## Tests

### T1: Configure per-user active request limit on a program
**What to test:** Create or edit a program and set the maxActiveRequestsPerUser setting
**Expected:** The program create/update form or API accepts a maxActiveRequestsPerUser value (integer, min 1). The value persists after saving.
**Status:** pending
**Result:**

### T2: Program-wide maxActiveRequests enforcement
**What to test:** Set a program's maxActiveRequests to a low number (e.g., 2), then try to create requests until the limit is hit
**Expected:** When the total active requests (submitted/in_review/approved) reach the limit, creating a new request fails with a clear error like "Program has reached its maximum active request limit of 2"
**Status:** pending
**Result:**

### T3: Per-user maxActiveRequestsPerUser enforcement
**What to test:** Set a program's maxActiveRequestsPerUser to a low number (e.g., 1), then as one user try to create a second active request
**Expected:** When the user's active requests reach their per-user limit, creating a new request fails with a clear error explaining the per-user limit was hit
**Status:** pending
**Result:**

### T4: Boundary limit indicators on program cards
**What to test:** On the Programs list page, check program cards that have boundary limits configured
**Expected:** Program cards show text indicators like "Max 10 active requests" and/or "Max 3 per user" when those limits are set. Cards without limits show no boundary text.
**Status:** pending
**Result:**

### T5: BoundaryStatsPanel on SheetViewPage
**What to test:** On the sheet view page for a program with configured limits, look for a "Limits" button (ShieldCheck icon) in the header — visible only to admin/manager users
**Expected:** Clicking the Limits button toggles a panel below the header showing: program-wide utilization bar (e.g., "42/100 active requests") with color coding (green < 70%, orange 70-90%, red > 90%), and a per-user breakdown table with each user's active count vs limit.
**Status:** pending
**Result:**

### T6: Utilization bar color coding
**What to test:** Create enough requests to push utilization above 70% and 90% thresholds
**Expected:** The utilization bar changes color: green when under 70%, orange between 70-90%, red above 90%.
**Status:** pending
**Result:**

### T7: Limits button role gating
**What to test:** Log in as a non-admin/non-manager user (e.g., a regular client) and navigate to the sheet view
**Expected:** The "Limits" button is NOT visible in the header for non-admin/non-manager users.
**Status:** pending
**Result:**

### T8: Boundary stats API access control
**What to test:** As a non-admin/non-manager user, try to access GET /api/v1/programs/:programId/boundary-stats directly
**Expected:** Returns 403 Forbidden — only admin and program managers can access boundary stats.
**Status:** pending
**Result:**

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0

## Gaps
