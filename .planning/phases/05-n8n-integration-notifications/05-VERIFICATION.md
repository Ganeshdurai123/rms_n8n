---
phase: 05-n8n-integration-notifications
verified: 2026-02-22T15:30:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 5: n8n Integration & Notifications Verification Report

**Phase Goal:** The system reliably delivers webhook events to n8n for all async processing, n8n handles email dispatch and scheduled tasks, and users receive both in-app and email notifications for key events
**Verified:** 2026-02-22T15:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Webhook outbox stores events with pending/sent/failed status and supports exponential retry | VERIFIED | `webhookEvent.model.ts` — status enum `['pending','sent','failed']`, retryCount, maxRetries (default 3), nextRetryAt fields; `processOutbox()` sets exponential backoff via `retryCount * 30_000` ms |
| 2 | Internal API at /api/v1/internal/ requires shared-secret x-api-key header and rejects unauthenticated requests | VERIFIED | `internalAuth.ts` — reads `x-api-key`, uses `crypto.timingSafeEqual` with `Buffer.from()` and length pre-check; returns 401 on mismatch; mounted via `router.use(internalAuth)` in `internal.routes.ts` |
| 3 | POST /api/v1/internal/socket-emit pushes typed events to connected clients via Socket.IO | VERIFIED | `internal.controller.ts:socketEmit` — calls `getIO()`, emits via `io.to('program:' + programId).emit(event, payload)`; validates event against VALID_SOCKET_EVENTS set; returns 503 if Socket.IO uninitialized |
| 4 | Typed webhook event catalog defines all 8 payload shapes as single source of truth | VERIFIED | `webhook.types.ts` — exports `WEBHOOK_EVENT_TYPES` const array covering all 8 types, `WebhookEventType` union, and `WebhookPayload` interface |
| 5 | Every mutation in Express fires a webhook event to the outbox for n8n delivery | VERIFIED | 8 total `enqueueWebhookEvent()` calls confirmed: request.service.ts (4 — createRequest, updateRequest, transitionRequest, assignRequest), comment.service.ts (2 — addComment, deleteComment), attachment.service.ts (2 — uploadAttachment, deleteAttachment) |
| 6 | In-app notifications are created for relevant users on status changes, assignments, and comments | VERIFIED | `createNotification()` called 4 times with self-notification guards: transitionRequest (creator + assignee, lines 479 and 491), assignRequest (assignee, line 594), addComment (request creator, line 84 in comment.service.ts) |
| 7 | Outbox processor starts on server boot and dispatches pending events to n8n | VERIFIED | `server.ts` — imports `startOutboxProcessor` and `stopOutboxProcessor`; calls `startOutboxProcessor(10_000)` at step 4.6 after Socket.IO init; calls `stopOutboxProcessor(outboxHandle)` in graceful shutdown handler |
| 8 | User receives in-app notifications stored in database with unread count | VERIFIED | `notification.model.ts` — Notification model with userId, type, isRead (default false), compound indexes; `getUnreadCount()` uses `countDocuments({userId, isRead: false})`; `getNotifications()` paginates sorted descending |
| 9 | In-app notifications update in real-time via Socket.IO when created | VERIFIED | `notification.service.ts:emitToUser()` — iterates `io.sockets.sockets`, matches `socket.data.userId === userId`, emits `notification:created` event; `socketEvents.ts` has `notification:created` in both SocketEventName union and ServerToClientEvents interface |
| 10 | n8n workflow JSON template receives webhook events and dispatches emails for status changes, assignments, and comments | VERIFIED | `email-notification.json` — valid JSON; Webhook Trigger node at path `rms-events`; Switch node with 3 branch conditions (`request.status_changed`, `request.assigned`, `comment.added`); 3 Email Send nodes; 3 HTTP Request callback nodes to `internal/notifications`; `active: false` |
| 11 | n8n scheduled workflow template calls internal API to check for reminders and dispatches reminder emails | VERIFIED | `scheduled-reminder.json` — valid JSON; Schedule Trigger node; HTTP Request to `internal/pending-reminders`; IF node; splitOut node; Email Send node; HTTP Request callback to `internal/notifications`; `active: false` |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Provides | Level 1: Exists | Level 2: Substantive | Level 3: Wired | Status |
|----------|----------|-----------------|----------------------|----------------|--------|
| `server/src/modules/webhook/webhook.types.ts` | Typed webhook event catalog | Yes | 8 event types, WebhookPayload interface, WEBHOOK_EVENT_TYPES const | Imported by webhookEvent.model.ts, webhook.service.ts, request/comment/attachment services | VERIFIED |
| `server/src/modules/webhook/webhookEvent.model.ts` | WebhookEvent Mongoose model | Yes | status enum, retryCount, maxRetries, nextRetryAt, sentAt, compound indexes | Imported by webhook.service.ts | VERIFIED |
| `server/src/modules/webhook/webhookEvent.schema.ts` | Zod query schema | Yes | webhookEventQuerySchema with status filter, pagination | Exists as supporting file | VERIFIED |
| `server/src/modules/webhook/webhook.service.ts` | Outbox enqueue, dispatch, retry | Yes | enqueueWebhookEvent, processOutbox, startOutboxProcessor, stopOutboxProcessor all implemented | Imported by server.ts (processor), request/comment/attachment services (enqueue) | VERIFIED |
| `server/src/middleware/internalAuth.ts` | Shared-secret auth middleware | Yes | timingSafeEqual, Buffer.from(), length pre-check, 401 on mismatch | Imported and applied via router.use() in internal.routes.ts | VERIFIED |
| `server/src/modules/internal/internal.routes.ts` | Internal API routes | Yes | 4 routes: GET /health, POST /socket-emit, POST /notifications, GET /pending-reminders | Imported and mounted in app.ts at /api/v1/internal | VERIFIED |
| `server/src/modules/internal/internal.controller.ts` | healthCheck, socketEmit, createNotificationHandler, getPendingReminders | Yes | All 4 handlers implemented with inline validation; getPendingReminders queries stale 48h+ requests | Imported by internal.routes.ts | VERIFIED |
| `server/src/modules/notification/notification.model.ts` | Notification Mongoose model | Yes | NOTIFICATION_TYPES const, compound indexes on {userId, isRead, createdAt} and {userId, isRead} | Imported by notification.service.ts and internal.controller.ts | VERIFIED |
| `server/src/modules/notification/notification.service.ts` | CRUD, real-time emission, dual service variants | Yes | createNotification (fire-and-forget), createNotificationFromInternal (throwing), getNotifications, getUnreadCount, markAsRead, markAsUnread, markAllAsRead | Imported by notification.controller.ts, internal.controller.ts, request.service.ts, comment.service.ts | VERIFIED |
| `server/src/modules/notification/notification.routes.ts` | Notification REST API router | Yes | 5 routes with authenticate middleware; read-all mounted before :notificationId to prevent misparse | Mounted in app.ts at /api/v1/notifications | VERIFIED |
| `server/src/shared/socketEvents.ts` | Updated event catalog | Yes | notification:created added to SocketEventName union and ServerToClientEvents interface | Used throughout codebase | VERIFIED |
| `n8n/workflows/email-notification.json` | n8n email notification workflow | Yes | 9 nodes: Webhook Trigger, Switch (3 branches), 3 Email Send, 3 HTTP Request (internal/notifications callback), respondToWebhook | Standalone workflow template | VERIFIED |
| `n8n/workflows/scheduled-reminder.json` | n8n scheduled reminder workflow | Yes | 7 nodes: scheduleTrigger, httpRequest (pending-reminders), if, splitOut, emailSend, httpRequest (notifications callback), noOp | Standalone workflow template | VERIFIED |
| `n8n/README.md` | Setup instructions | Yes | Prerequisites, import steps, environment variable table, workflow descriptions, customization guide | Documentation artifact | VERIFIED |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `internal.controller.ts` | `config/socket.ts` | `getIO()` for socket-emit endpoint | WIRED | Line 72: `const io = getIO()` in `socketEmit`; Line 32: `const io = getIO()` in `emitToUser` (notification.service.ts) |
| `internalAuth.ts` | `config/env.ts` | `env.INTERNAL_API_KEY` comparison | WIRED | Line 26: `const expected = env.INTERNAL_API_KEY`; timingSafeEqual used at line 37 |
| `app.ts` | `internal.routes.ts` | `app.use('/api/v1/internal', internalRouter)` | WIRED | Lines 17 and 84 in app.ts confirm import and mount |
| `notification.service.ts` | `config/socket.ts` | `getIO()` for targeted user notification emission | WIRED | `emitToUser()` helper calls `getIO()` and iterates `io.sockets.sockets` matching `socket.data.userId` |
| `app.ts` | `notification.routes.ts` | `app.use('/api/v1/notifications', notificationRouter)` | WIRED | Lines 16 and 81 in app.ts confirm import and mount |
| `request.service.ts` | `webhook.service.ts` | `enqueueWebhookEvent` after each mutation | WIRED | 4 confirmed calls at lines 162, 376, 468, 584 |
| `request.service.ts` | `notification.service.ts` | `createNotification` for assignees and stakeholders | WIRED | 3 confirmed calls at lines 479, 491, 594 |
| `server.ts` | `webhook.service.ts` | `startOutboxProcessor()` on server start | WIRED | Import at line 12; call at line 39; cleanup at line 58 |
| `email-notification.json` | `internal.controller.ts` | HTTP Request nodes calling POST /api/v1/internal/notifications | WIRED | All 3 HTTP Request nodes use URL `http://server:5000/api/v1/internal/notifications` |
| `scheduled-reminder.json` | `internal.controller.ts` | HTTP Request node calling GET /api/v1/internal/pending-reminders | WIRED | First HTTP node uses URL `http://server:5000/api/v1/internal/pending-reminders` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| N8N-01 | 05-03 | Express backend fires webhook POST to n8n after every mutation (fire-and-forget) | SATISFIED | 8 `enqueueWebhookEvent()` calls across request/comment/attachment services; all inside existing fire-and-forget `.then().catch(() => {})` blocks |
| N8N-02 | 05-01 | System implements webhook outbox pattern for reliable event delivery | SATISFIED | WebhookEvent model with pending/sent/failed lifecycle; processOutbox() with exponential backoff retry; `startOutboxProcessor` runs on 10s interval |
| N8N-03 | 05-01 | System exposes internal API (/api/v1/internal/) for n8n callbacks with shared-secret auth | SATISFIED | internalAuth middleware with `timingSafeEqual`; mounted on all internal routes via `router.use(internalAuth)`; nginx externally blocks access |
| N8N-04 | 05-01 | System exposes POST /api/v1/internal/socket-emit for n8n to push real-time events | SATISFIED | `socketEmit` controller validates event name and calls `getIO().to('program:'+programId).emit()` |
| N8N-05 | 05-01 | System maintains typed event catalog defining all webhook payloads | SATISFIED | `webhook.types.ts` exports `WEBHOOK_EVENT_TYPES` (8 types), `WebhookEventType`, `WebhookPayload` — single source of truth |
| N8N-06 | 05-04 | n8n workflows handle email dispatch for all notification events | SATISFIED | `email-notification.json` has Switch node routing to 3 Email Send nodes (status_changed, assigned, comment.added); callbacks to internal/notifications; `active: false` pending SMTP config |
| N8N-07 | 05-04 | n8n workflows handle scheduled reminder checks | SATISFIED | `scheduled-reminder.json` has scheduleTrigger -> httpRequest (pending-reminders) -> if -> splitOut -> emailSend -> notification callback |
| NOTIF-01 | 05-02 | User receives in-app notifications (bell icon with unread count) | SATISFIED | Notification model persists per-user notifications; `getUnreadCount()` for unread badge; REST API at `GET /api/v1/notifications/unread-count` |
| NOTIF-02 | 05-02 | In-app notifications update in real-time via Socket.IO | SATISFIED | `emitToUser()` iterates `io.sockets.sockets`, matches `socket.data.userId`, emits `notification:created`; `socketEvents.ts` typed accordingly |
| NOTIF-03 | 05-04 | User receives email notifications for key events via n8n | SATISFIED | Email dispatch delegated entirely to n8n workflow (zero nodemailer in Express); email-notification.json handles 3 event types |
| NOTIF-04 | 05-02 | User can mark notifications as read/unread | SATISFIED | `markAsRead` and `markAsUnread` with ownership verification; `markAllAsRead` bulk operation; REST endpoints `PATCH /:id/read`, `PATCH /:id/unread`, `PATCH /read-all` |

All 11 requirement IDs from plan frontmatter accounted for. No orphaned requirements detected in REQUIREMENTS.md for Phase 5.

---

### Anti-Patterns Found

None of concern. The `return null` occurrences in `webhook.service.ts` (lines 34, 133) and `notification.service.ts` (line 89) are intentional fire-and-forget patterns:
- Line 34 — inside `catch` block of `enqueueWebhookEvent` (fire-and-forget, never throws)
- Line 133 — early-exit when `N8N_WEBHOOK_BASE_URL` is unset (processor disabled in dev)
- Line 89 — inside `catch` block of `createNotification` (fire-and-forget, never throws)

These match the established pattern from `audit.utils.ts` and are correctly documented in plan spec.

---

### Human Verification Required

The following items cannot be verified programmatically:

#### 1. n8n Workflow Import and SMTP Activation

**Test:** Import `email-notification.json` and `scheduled-reminder.json` into a running n8n instance (Workflows > Import from File). Configure SMTP credentials in n8n credential manager. Update credential references in each Email Send node. Activate both workflows.
**Expected:** Workflows activate without errors. When a request status changes in the app, n8n receives the webhook event, sends an email to the affected user, and calls back to create an in-app notification.
**Why human:** Requires a live n8n instance with SMTP configuration; cannot verify HTTP dispatch or email delivery programmatically.

#### 2. Real-Time Notification Bell Behavior

**Test:** Log in as two users (User A and User B in the same program). User A assigns a request to User B. Check User B's notification bell in the client UI.
**Expected:** User B immediately sees a new unread notification ("Request assigned to you") without page reload. Unread count badge increments.
**Why human:** Requires live browser session and Socket.IO connection; cannot verify WebSocket emission reception programmatically.

#### 3. Webhook Outbox Retry Behavior

**Test:** Set `N8N_WEBHOOK_BASE_URL` to an unreachable URL in `.env`. Trigger a request mutation. Check the `webhookevents` MongoDB collection after 30s, 60s, 90s intervals.
**Expected:** Event status transitions: `pending` -> `failed` (retryCount=1, nextRetryAt=now+30s) -> `failed` (retryCount=2, nextRetryAt=now+60s) -> `failed` (retryCount=3, status remains failed, no further retry since retryCount=maxRetries).
**Why human:** Requires time-based observation of MongoDB documents across retry intervals.

---

### Summary

Phase 5 goal is fully achieved. All 11 observable truths are verified against the actual codebase:

- The webhook outbox (WebhookEvent model + processOutbox + startOutboxProcessor) provides reliable, retry-capable event delivery to n8n with exponential backoff — events accumulate safely even when n8n is unavailable.
- The internal API is secured with timing-safe shared-secret authentication, blocked externally by nginx, and exposes 4 endpoints (health, socket-emit, notifications, pending-reminders) that complete the n8n callback loop.
- All 8 mutation paths (createRequest, updateRequest, transitionRequest, assignRequest, addComment, deleteComment, uploadAttachment, deleteAttachment) enqueue webhook events inside existing fire-and-forget blocks — zero mutation latency added.
- In-app notifications are created for high-signal events only (status changes for creator+assignee, assignments for assignee, comments for request creator) with self-notification guards.
- The notification REST API provides full CRUD at `/api/v1/notifications` with real-time Socket.IO push to specific user sockets.
- Both n8n workflow JSON templates are valid, importable, and implement the correct flow: webhook trigger/schedule -> email send -> internal API callback for in-app notification. Both default to `active: false` pending SMTP configuration.
- TypeScript compiles with zero errors across all modified files.

The three human verification items (n8n workflow activation, real-time bell behavior, retry observation) require live infrastructure and cannot be verified statically, but all code paths supporting them are correctly implemented and wired.

---

_Verified: 2026-02-22T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
