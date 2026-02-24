---
phase: quick-notification-bell
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - client/src/lib/types.ts
  - client/src/components/layout/NotificationBell.tsx
  - client/src/components/layout/Header.tsx
autonomous: true
requirements: [NOTIF-BELL-01]

must_haves:
  truths:
    - "Bell icon visible in header with unread count badge"
    - "Clicking bell opens dropdown showing recent notifications"
    - "User can mark individual notification as read"
    - "User can mark all notifications as read"
    - "New notifications appear in real-time via socket without refresh"
    - "Unread count updates when notification:created socket event fires"
  artifacts:
    - path: "client/src/lib/types.ts"
      provides: "Notification interface"
      contains: "interface Notification"
    - path: "client/src/components/layout/NotificationBell.tsx"
      provides: "NotificationBell component with dropdown"
      min_lines: 80
    - path: "client/src/components/layout/Header.tsx"
      provides: "Header with NotificationBell integrated"
      contains: "NotificationBell"
  key_links:
    - from: "client/src/components/layout/NotificationBell.tsx"
      to: "/api/v1/notifications"
      via: "api.get and api.patch calls"
      pattern: "api\\.(get|patch).*notification"
    - from: "client/src/components/layout/NotificationBell.tsx"
      to: "socket notification:created"
      via: "useSocket hook"
      pattern: "notification:created"
    - from: "client/src/components/layout/Header.tsx"
      to: "client/src/components/layout/NotificationBell.tsx"
      via: "import and render"
      pattern: "import.*NotificationBell"
---

<objective>
Add a NotificationBell component to the application header that displays a bell icon with unread count badge, opens a popover dropdown with recent notifications, supports mark-read (individual and all), and listens for real-time notification:created socket events.

Purpose: Users currently have no visual indicator of new notifications in the header -- they must navigate to /notifications page. The bell provides instant awareness and quick access.
Output: NotificationBell component integrated in Header, Notification type in types.ts
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@client/src/components/layout/Header.tsx
@client/src/lib/types.ts
@client/src/lib/api.ts
@client/src/lib/socket.ts
@client/src/components/ui/popover.tsx
@client/src/components/ui/button.tsx
@client/src/components/ui/badge.tsx
@server/src/modules/notification/notification.model.ts
@server/src/modules/notification/notification.controller.ts
@server/src/modules/notification/notification.routes.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Notification type and NotificationBell component</name>
  <files>
    client/src/lib/types.ts
    client/src/components/layout/NotificationBell.tsx
  </files>
  <action>
**1. Add Notification interface to client/src/lib/types.ts:**

Append after the BoundaryStats interface (end of file). Match the server model fields (notification.model.ts INotificationDocument):

```typescript
// ---------- Notification Types ----------

export type NotificationType =
  | 'request.status_changed'
  | 'request.assigned'
  | 'request.created'
  | 'request.updated'
  | 'comment.added'
  | 'attachment.uploaded'
  | 'reminder';

export interface Notification {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  programId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

**2. Create NotificationBell.tsx:**

Create `client/src/components/layout/NotificationBell.tsx` with the following behavior:

- **State:** `notifications` (Notification[]), `unreadCount` (number), `open` (boolean for popover), `loading` (boolean)
- **On mount:** Fetch `GET /notifications?limit=10&page=1` and `GET /notifications/unread-count`. Store results.
- **Socket listener:** Use `useSocket` hook (same pattern as ActivityFeed.tsx) to listen for `notification:created` event. On receive, increment unreadCount by 1 and prepend the notification payload to the notifications list (cap at 10 items). The socket payload will have notification data embedded.
- **Polling fallback:** Use `useEffect` with `setInterval` every 30 seconds to re-fetch unread count from `GET /notifications/unread-count`. This catches notifications missed during brief disconnects. Clear interval on unmount.

**UI Structure (using existing components):**

```
Popover (from @/components/ui/popover)
  PopoverTrigger:
    Button variant="ghost" size="icon" className="relative"
      Bell icon (from lucide-react, className="h-5 w-5")
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
  PopoverContent align="end" className="w-80 p-0"
    Header div (px-4 py-3 border-b flex justify-between items-center):
      <h4 className="text-sm font-semibold">Notifications</h4>
      {unreadCount > 0 && (
        <button onClick={handleMarkAllRead} className="text-xs text-primary hover:underline">
          Mark all read
        </button>
      )}
    Scrollable list div (max-h-[300px] overflow-y-auto):
      {loading ? skeleton/spinner : (
        notifications.length === 0 ?
          <p className="p-4 text-sm text-muted-foreground text-center">No notifications</p>
        :
          notifications.map(n => (
            <div
              key={n._id}
              onClick={() => handleMarkRead(n)}
              className={cn(
                "flex flex-col gap-0.5 px-4 py-2.5 border-b last:border-b-0 cursor-pointer hover:bg-accent/50 transition-colors",
                !n.isRead && "bg-accent/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate flex-1">{n.title}</span>
                {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0 ml-2" />}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
              <span className="text-[10px] text-muted-foreground mt-0.5">{relativeTime(n.createdAt)}</span>
            </div>
          ))
      )}
    Footer div (px-4 py-2 border-t text-center):
      <a href="/notifications" className="text-xs text-primary hover:underline">View all</a>
```

**Handler functions:**

- `handleMarkRead(notification)`: If already read, return. Call `api.patch(`/notifications/${n._id}/read`)`. On success, update local state: set n.isRead = true in notifications array, decrement unreadCount by 1.
- `handleMarkAllRead()`: Call `api.patch('/notifications/read-all')`. On success, update local state: set all notifications isRead = true, set unreadCount = 0.
- `relativeTime(iso)`: Copy the relativeTime function from ActivityFeed.tsx (or extract to utils -- but copying is simpler per project pattern of co-locating utilities).

**Imports:** `useState`, `useEffect`, `useCallback` from react; `Bell` from lucide-react; `Popover`, `PopoverTrigger`, `PopoverContent` from `@/components/ui/popover`; `Button` from `@/components/ui/button`; `cn` from `@/lib/utils`; `api` from `@/lib/api`; `useSocket` from `@/lib/socket`; `Notification`, `PaginatedResponse` from `@/lib/types`.

**API response shapes (match existing backend):**
- `GET /notifications?limit=10&page=1` returns `PaginatedResponse<Notification>` (data array + pagination)
- `GET /notifications/unread-count` returns `{ count: number }`
- `PATCH /notifications/:id/read` returns `{ data: Notification }`
- `PATCH /notifications/read-all` returns `{ updated: number }`

**Error handling:** Wrap API calls in try/catch. On error, use console.error (no toast for background fetches -- consistent with Activity feed pattern). Do NOT show toast for polling failures.
  </action>
  <verify>
Run `npx tsc --noEmit --project client/tsconfig.app.json` from the project root -- should have no new type errors. Verify NotificationBell.tsx exists and imports resolve correctly.
  </verify>
  <done>
NotificationBell component exists at client/src/components/layout/NotificationBell.tsx. Notification type exists in types.ts. Component fetches notifications from API, listens for socket events, renders bell with badge, popover with notification list, supports mark-read and mark-all-read. TypeScript compiles without errors.
  </done>
</task>

<task type="auto">
  <name>Task 2: Integrate NotificationBell into Header</name>
  <files>
    client/src/components/layout/Header.tsx
  </files>
  <action>
Modify `client/src/components/layout/Header.tsx` to render NotificationBell in the header bar, positioned to the left of the user info section.

1. Add import: `import { NotificationBell } from '@/components/layout/NotificationBell';`
2. Inside the `{user && (...)}` block, place `<NotificationBell />` before the user name/badge/avatar group.

Updated JSX structure for the right side of the header:

```tsx
{user && (
  <div className="flex items-center gap-3">
    <NotificationBell />
    <span className="text-sm text-muted-foreground">
      {user.firstName} {user.lastName}
    </span>
    <Badge variant="outline" className="text-xs">
      {user.role.replace('_', ' ')}
    </Badge>
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
      {user.firstName.charAt(0).toUpperCase()}
    </div>
  </div>
)}
```

This keeps the existing layout intact and adds the bell as the first element in the user info group. The bell will visually separate from user info via the gap-3 spacing.
  </action>
  <verify>
Run `npx tsc --noEmit --project client/tsconfig.app.json` -- no errors. Start the dev server (`cd client && npm run dev`) and visually confirm the bell icon appears in the header next to the user name.
  </verify>
  <done>
Header renders NotificationBell component. Bell icon is visible in the header to the left of user info. Clicking bell opens popover with notifications. Unread badge shows count. Application compiles and runs without errors.
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit --project client/tsconfig.app.json` passes with no errors
2. Bell icon visible in header with unread badge (if unread notifications exist)
3. Clicking bell opens popover showing recent notifications
4. Clicking a notification marks it as read (blue dot disappears, unread count decrements)
5. "Mark all read" button clears all unread indicators
6. "View all" link navigates to /notifications page
7. When a new notification arrives via socket (notification:created), it appears at top of list and badge increments
</verification>

<success_criteria>
- NotificationBell component renders in Header
- Bell icon shows unread count badge (capped at "9+")
- Popover dropdown shows last 10 notifications with title, message, timestamp
- Unread notifications have visual indicator (accent background + blue dot)
- Mark-read (single) and mark-all-read work via API
- Socket listener for notification:created updates list and count in real-time
- 30-second polling fallback for unread count
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/1-add-notificationbell-component-to-header/1-SUMMARY.md`
</output>
