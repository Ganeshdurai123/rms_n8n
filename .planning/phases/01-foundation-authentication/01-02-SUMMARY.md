---
phase: 01-foundation-authentication
plan: 02
subsystem: auth
tags: [jwt, passport, bcryptjs, refresh-token, cookie, mongoose, zod]

# Dependency graph
requires:
  - phase: 01-foundation-authentication/01
    provides: Express skeleton, Mongoose connection, cookie-parser, Zod validation middleware, error handling, env config with JWT secrets
provides:
  - User Mongoose model with email (unique), password (bcrypt hashed, select:false), role (4 values), isActive
  - RefreshToken Mongoose model with hashed token, tokenFamily (reuse detection), TTL auto-delete
  - Passport JWT strategy extracting Bearer token from Authorization header
  - authenticate middleware returning JSON 401 on failure
  - Auth service with register, login, refreshAccessToken, logout business logic
  - Auth controller with 5 endpoints (register, login, refresh, logout, me)
  - Auth routes mounted at /api/v1/auth
  - Zod validation schemas for register and login
  - Shared types (Role, IUser, Express User augmentation)
affects: [01-03-rbac-users, all-subsequent-phases]

# Tech tracking
tech-stack:
  added: [passport, passport-jwt, passport-local, jsonwebtoken, bcryptjs, nanoid]
  patterns: [JWT access+refresh token pair, refresh token rotation with family tracking, HttpOnly cookie for refresh tokens, service-layer business logic, thin controller pattern]

key-files:
  created:
    - server/src/modules/auth/auth.model.ts
    - server/src/modules/auth/refreshToken.model.ts
    - server/src/modules/auth/auth.schema.ts
    - server/src/modules/auth/auth.service.ts
    - server/src/modules/auth/auth.controller.ts
    - server/src/modules/auth/auth.routes.ts
    - server/src/config/passport.ts
    - server/src/middleware/authenticate.ts
    - server/src/shared/types.ts
  modified:
    - server/src/app.ts
    - server/package.json

key-decisions:
  - "Used nanoid@3 (CJS) instead of nanoid@5 (ESM-only) for NodeNext module compatibility"
  - "Cast JWT expiresIn as SignOptions to satisfy @types/jsonwebtoken StringValue type requirement"
  - "Refresh token bcrypt rounds set to 10 (vs 12 for passwords) since refresh tokens are already high-entropy random strings"
  - "Logout does NOT require authenticate middleware - identity derived from refresh token cookie so users with expired access tokens can still log out"
  - "Auth routes mounted directly on app (not apiRouter) to keep /api/v1/auth path clean"

patterns-established:
  - "Service-layer pattern: Controllers never touch models directly, all business logic in service functions"
  - "Token pair generation: access token (15min, sub+role) + refresh token (7d, sub+family+jti) with bcrypt-hashed storage"
  - "Refresh token rotation: old token revoked on use, new token issued in same family, replay of rotated token revokes entire family"
  - "HttpOnly cookie pattern: refresh token in httpOnly+secure+sameSite=strict cookie, path restricted to /api/v1/auth"
  - "User sanitization: toObject() then destructure to remove password and __v before API response"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05]

# Metrics
duration: 8min
completed: 2026-02-20
---

# Phase 1 Plan 2: Authentication Summary

**JWT auth with refresh token rotation using bcryptjs-hashed token families in HttpOnly cookies, 5 auth endpoints (register, login, refresh, logout, me), and Passport JWT strategy**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-20T11:26:56Z
- **Completed:** 2026-02-20T11:34:43Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Complete auth module with User model (email unique, password bcrypt-hashed at 12 rounds, select:false), 4 roles, isActive flag
- RefreshToken model with bcrypt-hashed tokens, tokenFamily UUID for reuse detection, TTL auto-delete via MongoDB expireAfterSeconds
- Refresh token rotation: on each refresh, old token revoked, new token issued in same family; replaying a previously-rotated token revokes the entire family (per PITFALLS.md Pitfall 5)
- 5 auth endpoints: POST register (201 + cookie), POST login (200 + cookie), POST refresh (200, rotates tokens), POST logout (200, revokes family, no auth required), GET me (200, requires authenticate)
- Passport JWT strategy and authenticate middleware with JSON 401 response (not Passport's default text)

## Task Commits

Each task was committed atomically:

1. **Task 1: User model, RefreshToken model, Passport JWT strategy, and authenticate middleware** - `74020fe` (feat)
2. **Task 2: Auth routes, service, controller (register, login, refresh, logout, me)** - `554e6d9` (feat)

## Files Created/Modified
- `server/src/modules/auth/auth.model.ts` - User Mongoose model with email (unique, lowercase), bcrypt password hashing, comparePassword method
- `server/src/modules/auth/refreshToken.model.ts` - RefreshToken model with hashed token, userId, tokenFamily, isRevoked, TTL index
- `server/src/modules/auth/auth.schema.ts` - Zod schemas for register (email, password 8-128, names) and login validation
- `server/src/modules/auth/auth.service.ts` - Business logic: register, login, refreshAccessToken, logout with token pair generation
- `server/src/modules/auth/auth.controller.ts` - Thin controller: sets HttpOnly cookies, delegates to service, returns JSON
- `server/src/modules/auth/auth.routes.ts` - 5 route definitions with Zod validation and authenticate middleware
- `server/src/config/passport.ts` - Passport JWT strategy: extract Bearer token, find user by ID, check isActive
- `server/src/middleware/authenticate.ts` - JWT auth middleware with custom JSON 401 error response
- `server/src/shared/types.ts` - Role type, IUser interface, Express.User augmentation
- `server/src/app.ts` - Added passport.initialize() and authRouter mount at /api/v1/auth
- `server/package.json` - Added passport, passport-jwt, jsonwebtoken, bcryptjs, nanoid, and type packages

## Decisions Made
- Used nanoid@3 (CJS compatible) instead of nanoid@5 (ESM-only) because the project uses NodeNext module resolution and nanoid@5 is pure ESM which requires different import handling
- Cast JWT expiresIn option as SignOptions type to satisfy the newer @types/jsonwebtoken which uses a branded StringValue type from the ms package
- Set refresh token bcrypt rounds to 10 (vs 12 for passwords) since refresh tokens are already high-entropy random strings - the lower round count reduces latency on token refresh operations
- Logout endpoint does NOT use authenticate middleware - identity is derived from the refresh token cookie's JWT payload, allowing users with expired access tokens to still log out
- Auth routes mounted directly on app (app.use('/api/v1/auth', authRouter)) rather than on apiRouter to keep the /api/v1/auth path clean and separate from the generic API router

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] nanoid version downgrade from v5 to v3**
- **Found during:** Task 1 (dependency installation)
- **Issue:** nanoid@5 is ESM-only and would require different import handling with NodeNext module resolution. The plan specified nanoid without a version.
- **Fix:** Installed nanoid@3 which provides CJS compatibility and works with the project's module system
- **Files modified:** server/package.json
- **Verification:** `node -e "const {nanoid} = require('nanoid'); console.log(nanoid())"` succeeds
- **Committed in:** 74020fe (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TypeScript type error with JWT expiresIn**
- **Found during:** Task 2 (auth service implementation)
- **Issue:** @types/jsonwebtoken now uses a branded `StringValue` type from the `ms` package for `expiresIn`, causing TS2769 "No overload matches this call" when passing plain strings from env config
- **Fix:** Cast the options object as `SignOptions` type to satisfy the overload resolution
- **Files modified:** server/src/modules/auth/auth.service.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 554e6d9 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking dependency, 1 type error bug)
**Impact on plan:** Both auto-fixes were necessary for the code to compile and run. No scope creep.

## Issues Encountered
- Docker/MongoDB not available in the execution environment, so curl-based integration testing of the full auth flow was not possible. Verification was limited to TypeScript compilation, file existence, and pattern verification. Full flow testing should be done when Docker Compose services are running.

## User Setup Required
None - no external service configuration required. JWT secrets and token expiry settings are already defined in .env.example from Plan 01.

## Next Phase Readiness
- Auth module is complete and ready for RBAC middleware (01-03-PLAN.md)
- authenticate middleware is available for protecting any route
- User model is ready for role-based authorization checks
- Token pair generation is ready for use with any auth flow
- All 5 auth endpoints are mounted and ready for integration testing once Docker services start

## Self-Check: PASSED

- All 9 created files verified present on disk
- All 2 task commit hashes verified in git log (74020fe, 554e6d9)
- TypeScript compiles clean (npx tsc --noEmit passes)

---
*Phase: 01-foundation-authentication*
*Completed: 2026-02-20*
