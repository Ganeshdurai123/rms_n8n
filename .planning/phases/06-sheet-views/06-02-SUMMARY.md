---
phase: 06-sheet-views
plan: 02
subsystem: ui
tags: [react, react-router, axios, jwt, shadcn-ui, tailwindcss, sonner]

# Dependency graph
requires:
  - phase: 01-foundation-authentication
    provides: "JWT auth endpoints (login, logout, refresh, me)"
  - phase: 02-programs-dynamic-fields
    provides: "Program CRUD API with access-scoped listing"
provides:
  - "Axios API client with automatic JWT token refresh and request queuing"
  - "AuthContext with login/logout/session-check and ProtectedRoute component"
  - "Shared TypeScript interfaces matching server data shapes"
  - "Login page with email/password form and error handling"
  - "Program list page with card grid, loading skeletons, and empty state"
  - "Layout shell with sidebar navigation, header, and outlet"
  - "React Router configuration with protected routes"
  - "shadcn/ui base components (button, input, label, card, badge, skeleton)"
affects: [06-sheet-views, 07-request-books, 08-client-collaboration]

# Tech tracking
tech-stack:
  added: [react-router-dom@6, axios@1, sonner@1, "@radix-ui/react-slot", "@radix-ui/react-label"]
  patterns: [jwt-interceptor-with-refresh-queue, auth-context-provider, protected-route-outlet, shadcn-ui-new-york-style]

key-files:
  created:
    - client/src/lib/api.ts
    - client/src/lib/auth.tsx
    - client/src/lib/types.ts
    - client/src/pages/LoginPage.tsx
    - client/src/pages/ProgramListPage.tsx
    - client/src/components/layout/AppLayout.tsx
    - client/src/components/layout/Sidebar.tsx
    - client/src/components/layout/Header.tsx
    - client/src/components/ui/sonner.tsx
    - client/src/components/ui/button.tsx
    - client/src/components/ui/input.tsx
    - client/src/components/ui/label.tsx
    - client/src/components/ui/card.tsx
    - client/src/components/ui/badge.tsx
    - client/src/components/ui/skeleton.tsx
  modified:
    - client/src/App.tsx
    - client/package.json

key-decisions:
  - "Access token stored in module-level variable (not localStorage) for security -- prevents XSS token theft"
  - "Refresh interceptor uses request queue pattern to prevent multiple simultaneous refresh attempts"
  - "AuthProvider checks session on mount via GET /auth/me -- supports page refresh without re-login"
  - "shadcn CLI output placed files in wrong directory on Windows (@ vs src/) -- manually relocated to src/components/ui/"

patterns-established:
  - "JWT interceptor pattern: module-level token + request interceptor + 401 response interceptor with queue"
  - "Auth context pattern: AuthProvider wraps app, ProtectedRoute uses Outlet for nested protected routes"
  - "Layout pattern: AppLayout with fixed Sidebar + Header wrapping Outlet for page content"
  - "Page data fetching: useEffect with cancellation flag and loading/error/data states"

requirements-completed: [SHEET-01]

# Metrics
duration: 14min
completed: 2026-02-22
---

# Phase 6 Plan 02: Client Bootstrap Summary

**React client with JWT auth, API client with refresh queue, login page, program list, sidebar layout, and React Router protected routing**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-22T18:30:40Z
- **Completed:** 2026-02-22T18:45:00Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Axios API client with automatic JWT token refresh and failed-request queuing on 401
- AuthContext providing login, logout, session persistence, and ProtectedRoute with loading skeleton
- Login page with shadcn/ui Card, Input, Label, Button components and error display
- Program list page with responsive card grid, loading skeletons, and empty state
- Layout shell with fixed sidebar (nav links, user info, logout) and header (user avatar, role badge)
- React Router with protected routes, login redirect, and placeholder sheet view route

## Task Commits

Each task was committed atomically:

1. **Task 1: Install client dependencies and create API client, types, and auth context** - `72dd5ca` (feat)
2. **Task 2: Create layout shell, login page, program list page, and wire routing** - `5f37a0a` (feat)

## Files Created/Modified
- `client/src/lib/api.ts` - Axios client with JWT interceptor and refresh queue
- `client/src/lib/auth.tsx` - AuthProvider, useAuth, ProtectedRoute, LogoutButton
- `client/src/lib/types.ts` - Shared TypeScript interfaces (User, Program, RequestItem, PaginatedResponse)
- `client/src/pages/LoginPage.tsx` - Login form with error handling and redirect
- `client/src/pages/ProgramListPage.tsx` - Program card grid with loading and empty states
- `client/src/components/layout/AppLayout.tsx` - Main layout with Sidebar + Header + Outlet
- `client/src/components/layout/Sidebar.tsx` - Fixed sidebar with navigation, user info, logout
- `client/src/components/layout/Header.tsx` - Top header with user avatar and role badge
- `client/src/components/ui/sonner.tsx` - Sonner toast wrapper
- `client/src/components/ui/button.tsx` - shadcn/ui Button component
- `client/src/components/ui/input.tsx` - shadcn/ui Input component
- `client/src/components/ui/label.tsx` - shadcn/ui Label component
- `client/src/components/ui/card.tsx` - shadcn/ui Card component
- `client/src/components/ui/badge.tsx` - shadcn/ui Badge component
- `client/src/components/ui/skeleton.tsx` - shadcn/ui Skeleton component
- `client/src/App.tsx` - Rewired with BrowserRouter, AuthProvider, and route definitions
- `client/package.json` - Added runtime and dev dependencies

## Decisions Made
- Access token stored in module-level variable (not localStorage) to prevent XSS token theft
- Refresh interceptor uses isRefreshing flag + failedQueue array to prevent multiple simultaneous refresh attempts and replay queued requests after token renewal
- AuthProvider checks session on mount via GET /auth/me to support page refresh without re-login (refresh cookie may still be valid)
- shadcn CLI resolved @ alias literally to a directory on Windows -- manually relocated generated files from client/@/components/ui/ to client/src/components/ui/

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn CLI generated files in wrong directory**
- **Found during:** Task 1 (shadcn component installation)
- **Issue:** `npx shadcn@latest add` resolved the `@` path alias literally, creating files in `client/@/components/ui/` instead of `client/src/components/ui/`
- **Fix:** Manually moved all 6 component files to correct location and removed the erroneous `@/` directory
- **Files modified:** client/src/components/ui/*.tsx
- **Verification:** TypeScript compilation passes, Vite build succeeds
- **Committed in:** 72dd5ca (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor path correction, no scope change.

## Issues Encountered
None beyond the shadcn CLI path issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Client foundation is complete with auth, routing, and layout shell
- Sheet view route placeholder exists at /programs/:programId/sheet for 06-03 implementation
- All shadcn/ui base components available for future pages
- API client with JWT refresh ready for all protected API calls

---
*Phase: 06-sheet-views*
*Completed: 2026-02-22*
