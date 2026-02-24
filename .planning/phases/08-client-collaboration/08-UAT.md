---
status: testing
phase: 08-client-collaboration
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md
started: 2026-02-23T06:00:00Z
updated: 2026-02-23T06:00:00Z
---

## Current Test

number: 1
name: Client sees only assigned programs
expected: |
  Log in as a client role user who is assigned to at least one program. The program list page shows ONLY programs the client is a member of — no other program names or data visible.
awaiting: user response

## Tests

### 1. Client sees only assigned programs
expected: Log in as a client role user who is assigned to at least one program. The program list page shows ONLY programs the client is a member of — no other program names or data visible.
result: [pending]

### 2. Client creates a request
expected: As the client user, open an assigned program's sheet view. Click the "New Request" (plus) button. Fill in the form fields and submit. The new request appears in the sheet with status "draft".
result: [pending]

### 3. Row click opens request detail
expected: In the sheet view, click on a request row. The app navigates to a request detail page showing the request's title, status badge, priority, assignee, creator, and any custom field values in a header section.
result: [pending]

### 4. Comment timeline with add form
expected: On the request detail page, click the "Comments" tab. A comment timeline is shown (may be empty). Type a comment in the text area and submit. The comment appears in the timeline with your name and timestamp.
result: [pending]

### 5. Upload and download attachment
expected: On the request detail page, click the "Attachments" tab. Upload a file using the upload button. The file appears in the attachment list with name and size. Click the download button — the file downloads successfully.
result: [pending]

### 6. Audit history tab
expected: On the request detail page, click the "History" tab. An audit timeline displays entries for past actions (e.g., "created request", "changed status") with timestamps and performer names.
result: [pending]

### 7. Client UI restrictions — no import buttons
expected: As a client role user on the sheet view, the toolbar does NOT show "Import" or "Import History" buttons. These buttons should only appear for admin/manager roles.
result: [pending]

### 8. Client UI restrictions — no assignee filter
expected: As a client role user on the sheet view, the filter toolbar does NOT show an "Assignee" dropdown filter. The status, priority, and search filters remain visible.
result: [pending]

### 9. Client cannot access another client's request
expected: As a client user, manually type a URL to a request created by a different user (e.g., /programs/{programId}/requests/{otherUsersRequestId}). The app shows a 403 Forbidden error or redirects — it does NOT display the request detail.
result: [pending]

### 10. Import route blocked for client
expected: As a client user, manually navigate to /programs/{programId}/import. The backend returns 403 Forbidden. The import wizard does NOT load.
result: [pending]

### 11. Real-time sheet refresh
expected: Open two browser tabs logged in as different users in the same program. In tab 1, create or update a request. Tab 2's sheet view auto-refreshes within a few seconds — the change appears WITHOUT manual page refresh.
result: [pending]

### 12. Real-time request detail updates
expected: Open the same request detail page in two browser tabs (different users). In tab 1, add a comment. Tab 2's request detail page auto-refreshes to show the new comment WITHOUT manual page refresh.
result: [pending]

### 13. Activity feed shows live events
expected: On the sheet view or request detail page, an activity feed panel/section is visible (may be collapsible). When another user performs an action in the same program, a new entry appears in the feed with an icon, performer name, action description, and relative time.
result: [pending]

## Summary

total: 13
passed: 0
issues: 0
pending: 13
skipped: 0

## Gaps

[none yet]
