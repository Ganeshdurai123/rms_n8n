# Stack Research

**Domain:** Request Management System with n8n Automation
**Researched:** 2026-02-20
**Confidence:** MEDIUM (versions not verified against live registry — WebSearch/WebFetch/Bash unavailable; all versions based on training data through May 2025; actual latest may differ)

---

## Locked Core Stack (Non-Negotiable)

These are decided. Versions listed are the recommended pinned versions for a greenfield project starting Feb 2026. Mark `~` to accept patch updates only.

### Frontend

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| React | ~18.3.1 | UI library | Stable, battle-tested. React 19 may be GA by now but 18.3.x is the safe lock for production. Do NOT jump to 19 without verifying shadcn/ui compatibility. | LOW — verify `npm view react version` |
| TypeScript | ~5.6.x | Type safety | 5.6 is latest stable in training data. Pin to minor. | LOW — verify |
| Vite | ~6.0.x | Build tool / dev server | Vite 6 released Dec 2024. Fast HMR, native ESM. If 6.x causes issues, fall back to 5.4.x which is rock-solid. | LOW — verify |
| Tailwind CSS | ~3.4.x | Utility-first CSS | 3.4 is the latest v3 stable. Tailwind v4 entered beta; do NOT use v4 yet — shadcn/ui and ecosystem plugins assume v3 config format (`tailwind.config.ts`). | MEDIUM |
| shadcn/ui | latest CLI | Component library (copy-paste) | Not a versioned npm package — it's a CLI that copies components into your project. Always run `npx shadcn@latest init` with `--style new-york`. Components are owned by you after copy. | HIGH |
| Vite plugin: `@vitejs/plugin-react-swc` | ~3.7.x | React SWC transform for Vite | SWC is 20x faster than Babel for transforms. Use this over `@vitejs/plugin-react`. | MEDIUM |

### Backend

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Node.js | 20 LTS (^20.11) | Runtime | LTS until Apr 2026. Node 22 LTS is also available — either is fine but 20 has broader Docker image stability. Pin in Dockerfile `node:20-alpine`. | MEDIUM |
| Express.js | ~4.21.x | HTTP framework | Express 5 reached RC but is NOT production-ready for ecosystem compatibility (middleware, error handling changes). Stay on 4.x. | MEDIUM |
| TypeScript | ~5.6.x | Type safety (shared with frontend) | Same version across monorepo. | LOW — verify |
| Mongoose | ~8.9.x | MongoDB ODM | Mongoose 8.x supports MongoDB 7, has improved TypeScript generics, and discriminators for dynamic fields. | LOW — verify |
| Passport.js | ~0.7.x | Auth middleware | Stable. Use with `passport-jwt` strategy (^4.0.1) and `passport-local` (^1.0.0). | MEDIUM |
| jsonwebtoken | ~9.0.x | JWT signing/verification | Standard. Use `jose` (^5.x) only if you need JOSE/JWE — overkill for simple JWT. | MEDIUM |
| Socket.IO | ~4.8.x | Real-time WebSocket | 4.x is stable, good Redis adapter support. | LOW — verify |
| Zod | ~3.23.x | Schema validation | 3.23 is latest stable. Zod 4 may be in preview — do NOT use, API changes. | LOW — verify |

### Database & Cache

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| MongoDB | 7.0 | Primary database | Use `mongo:7.0` Docker image. Supports compound wildcard indexes useful for dynamic fields. | HIGH |
| Redis | 7.2 | Cache layer (NO queues) | Use `redis:7.2-alpine` Docker image. Use for session cache, rate-limit counters, and Socket.IO adapter. Do NOT use for BullMQ or any queue — n8n replaces that. | HIGH |

### Automation & Infrastructure

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| n8n | latest (self-hosted Docker) | Workflow automation | Use `n8nio/n8n:latest` or pin to a specific version like `1.70.x` after testing. n8n replaces all cron, email, background jobs. | LOW — verify current version |
| Docker Compose | v2 | Container orchestration | Use `docker compose` (v2 syntax, not `docker-compose`). | HIGH |
| Nginx | alpine | Reverse proxy | `nginx:1.27-alpine`. Serves frontend build, proxies `/api` to Express, proxies `/socket.io` with WebSocket upgrade. | MEDIUM |
| PostgreSQL | 16-alpine | n8n metadata DB | n8n requires its own DB. Use `postgres:16-alpine`. This is NOT your app DB — only n8n uses it. | MEDIUM |

---

## Complementary Libraries (Supporting)

### Frontend — UI & Data

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `@tanstack/react-query` | ~5.62.x | Server state management | ALL API calls. Handles caching, refetching, optimistic updates. Replaces manual useEffect + useState for data fetching. | MEDIUM |
| `@tanstack/react-table` | ~8.20.x | Headless table engine | Dynamic sheet columns, request list views, sortable/filterable tables. Pairs perfectly with shadcn/ui DataTable pattern. | MEDIUM |
| `react-hook-form` | ~7.54.x | Form handling | All forms (request creation, program config, login). Native Zod integration via `@hookform/resolvers`. | MEDIUM |
| `@hookform/resolvers` | ~3.9.x | Zod resolver for react-hook-form | Always. Connects Zod schemas to react-hook-form validation. | MEDIUM |
| `zustand` | ~5.0.x | Client state management | Global UI state only (sidebar state, theme, current user). Do NOT use for server state — that's react-query's job. | MEDIUM |
| `react-router-dom` | ~7.0.x | Client-side routing | All routing. v7 is the successor to v6 with better data loading. If v7 causes issues, v6.28.x is stable fallback. | LOW — verify |
| `date-fns` | ~4.1.x | Date manipulation | Date formatting, relative time, calendar calculations. Use over dayjs (smaller API surface for tree-shaking) and over moment.js (deprecated). | MEDIUM |
| `lucide-react` | ~0.468.x | Icons | shadcn/ui uses Lucide icons natively. Do NOT add a separate icon library. | MEDIUM |
| `sonner` | ~1.7.x | Toast notifications | shadcn/ui's recommended toast solution. Already integrated in shadcn/ui. | MEDIUM |
| `cmdk` | ~1.0.x | Command palette | shadcn/ui's command component uses this. Useful for quick-search across requests/programs. | MEDIUM |
| `recharts` | ~2.14.x | Charts | Dashboard charts, report visualizations. shadcn/ui has chart components built on Recharts. | MEDIUM |
| `axios` | ~1.7.x | HTTP client | API calls from frontend. Use with react-query. Interceptors for JWT refresh logic. Prefer over native fetch for interceptor support and request/response transforms. | MEDIUM |

### Frontend — File Handling

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `react-dropzone` | ~14.3.x | Drag-and-drop file upload UI | File attachment on requests, request book CSV/Excel upload. | MEDIUM |
| `xlsx` (SheetJS CE) | ~0.18.5 | Excel/CSV parsing (client-side) | Request book import: parse Excel/CSV in browser for field mapping preview before upload. Community edition is free. | MEDIUM |
| `papaparse` | ~5.4.x | CSV parsing (alternative) | If you only need CSV (not Excel), PapaParse is lighter and simpler than SheetJS. Use SheetJS if Excel is required. | HIGH |

### Backend — Core Middleware

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `cors` | ~2.8.5 | CORS middleware | Always. Configure allowed origins for frontend URL. | HIGH |
| `helmet` | ~8.0.x | Security headers | Always. Adds CSP, X-Frame-Options, etc. | MEDIUM |
| `express-rate-limit` | ~7.4.x | Rate limiting | All public endpoints. Store rate-limit counters in Redis via `rate-limit-redis`. | MEDIUM |
| `rate-limit-redis` | ~4.2.x | Redis store for rate limiter | Pairs with express-rate-limit for distributed rate limiting across multiple Express instances. | MEDIUM |
| `compression` | ~1.7.5 | Gzip responses | Always in production. Or let Nginx handle it (preferred). | HIGH |
| `morgan` | ~1.10.x | HTTP request logging | Development. In production, use `pino` or `winston` instead. | HIGH |
| `cookie-parser` | ~1.4.7 | Cookie parsing | If refresh tokens are sent via httpOnly cookies (recommended pattern). | HIGH |

### Backend — Auth & Security

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `bcryptjs` | ~2.4.3 | Password hashing | User registration, password change. Use `bcryptjs` (pure JS) over `bcrypt` (native addon) for Docker compatibility. | HIGH |
| `passport-jwt` | ~4.0.1 | JWT strategy for Passport | All protected routes. Extract JWT from Bearer header. | MEDIUM |
| `passport-local` | ~1.0.0 | Username/password strategy | Login endpoint. | HIGH |
| `uuid` | ~10.0.x | UUID generation | Unique identifiers for webhook payloads, idempotency keys. | LOW — verify |
| `nanoid` | ~5.0.x | Short ID generation | User-facing IDs (request numbers, program codes). Shorter and URL-safe vs UUID. | MEDIUM |

### Backend — File Upload & Processing

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `multer` | ~1.4.5-lts.1 | Multipart file upload | File attachments on requests. Store to local disk or S3-compatible storage. | HIGH |
| `csv-parse` | ~5.6.x | CSV parsing (server-side) | Server-side validation of uploaded CSVs for request book import. Part of the `csv` package family. | MEDIUM |
| `exceljs` | ~4.4.x | Excel read/write (server-side) | Server-side Excel parsing for request books AND Excel export for reports. Preferred over SheetJS on server because it streams large files. | MEDIUM |

### Backend — PDF & Reports

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `pdfkit` | ~0.15.x | PDF generation | Report PDF generation. Programmatic — good for structured tabular reports. | MEDIUM |
| `@react-pdf/renderer` | ~4.1.x | React-based PDF generation | Alternative to pdfkit if you want JSX-based PDF templates. Heavier but more maintainable templates. Choose ONE, not both. | LOW — verify |

**Recommendation:** Use `pdfkit` for v1 reports. It's lighter, server-side only, no React dependency on backend. Move to `@react-pdf/renderer` only if PDF templates become complex enough to warrant JSX.

### Backend — Redis & Caching

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `ioredis` | ~5.4.x | Redis client | ALL Redis operations. Superior to `redis` (node-redis) for: Lua scripting, cluster support, better reconnection. | MEDIUM |
| `@socket.io/redis-adapter` | ~8.3.x | Socket.IO Redis adapter | Multi-instance Socket.IO. Required if you ever run >1 Express instance. Install from day 1. | MEDIUM |

### Backend — Logging & Monitoring

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `winston` | ~3.17.x | Structured logging | Production logging. JSON format for log aggregation. | MEDIUM |
| `winston-daily-rotate-file` | ~5.0.x | Log rotation | Rotate log files daily, auto-cleanup old logs. | MEDIUM |

### Shared (Frontend + Backend)

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `zod` | ~3.23.x | Schema validation | Shared validation schemas. Define once, use on both frontend (form validation) and backend (request validation). Put in a shared `packages/shared` or `common/` directory. | LOW — verify |
| `socket.io-client` | ~4.8.x | Socket.IO client | Frontend real-time connection. Must match server Socket.IO major version. | LOW — verify |

### Development Tools

| Tool | Version | Purpose | Notes | Confidence |
|------|---------|---------|-------|------------|
| `tsx` | ~4.19.x | TypeScript execution | Run TS files directly for scripts, seeds, migrations. Replaces `ts-node` (faster, ESM-compatible). | MEDIUM |
| `vitest` | ~2.1.x | Test runner | Unit + integration tests. Native Vite integration, faster than Jest for Vite projects. | MEDIUM |
| `@testing-library/react` | ~16.1.x | React component testing | Component tests with vitest. | LOW — verify |
| `supertest` | ~7.0.x | HTTP assertion | API endpoint integration tests. | MEDIUM |
| `eslint` | ~9.15.x | Linting | Flat config format (eslint.config.ts). ESLint 9 uses flat config by default. | LOW — verify |
| `prettier` | ~3.4.x | Code formatting | Consistent formatting. Use with eslint-config-prettier to disable conflicting rules. | MEDIUM |
| `lint-staged` | ~15.2.x | Pre-commit linting | Run lint/format only on staged files. | MEDIUM |
| `husky` | ~9.1.x | Git hooks | Pre-commit hook for lint-staged. | MEDIUM |
| `concurrently` | ~9.1.x | Run multiple processes | Dev mode: run frontend + backend + n8n simultaneously. | MEDIUM |
| `dotenv` | ~16.4.x | Env var loading | Load `.env` files in development. Not needed in Docker (use env_file in compose). | HIGH |

---

## n8n Integration Patterns

### Webhook Pattern (Express --> n8n)

```
Express mutation happens
  --> POST to n8n webhook URL (fire-and-forget)
  --> n8n workflow triggers
  --> n8n processes (email, report, etc.)
  --> n8n calls back Express API OR writes to MongoDB directly
```

**Key design decisions:**

1. **Fire-and-forget from Express:** Use `axios.post(N8N_WEBHOOK_URL, payload).catch(err => logger.error(err))`. Wrap in try/catch. Never `await` the n8n response in the main request flow. Response to client should not depend on n8n.

2. **Webhook URL management:** Store n8n webhook URLs in environment variables:
   ```
   N8N_WEBHOOK_BASE_URL=http://n8n:5678/webhook
   N8N_WEBHOOK_REQUEST_STATUS_CHANGE=/request-status-change
   N8N_WEBHOOK_REQUEST_ASSIGNED=/request-assigned
   N8N_WEBHOOK_DAILY_REMINDER=/daily-reminder
   N8N_WEBHOOK_REPORT_GENERATE=/report-generate
   ```

3. **Callback pattern:** n8n calls back into Express using an internal API key:
   ```
   POST /api/v1/internal/socket-emit   (push real-time events)
   POST /api/v1/internal/notifications  (create in-app notifications)
   PATCH /api/v1/internal/requests/:id  (update request status after processing)
   ```
   Protect `/internal/*` routes with `X-Internal-Api-Key` header, only accessible within Docker network.

4. **n8n direct MongoDB access:** For read-heavy operations (report generation), n8n can read MongoDB directly using its built-in MongoDB node. For writes, prefer calling back into Express API to maintain validation and audit log consistency.

5. **Idempotency:** Include a unique `eventId` (nanoid) in every webhook payload. n8n workflows should check for duplicate `eventId` before processing to handle retries.

### n8n Workflow Categories

| Category | Trigger | What It Does |
|----------|---------|-------------|
| Status change notifications | Webhook from Express | Send email to assignee/requester, create in-app notification, emit socket event |
| Assignment notifications | Webhook from Express | Email new assignee, update activity feed |
| Daily reminders | n8n cron (Schedule trigger) | Query overdue requests from MongoDB, send reminder emails |
| Report generation | Webhook from Express | Query MongoDB, generate PDF/CSV, store file, notify requester |
| Email dispatch | Webhook from Express | All transactional email (never use nodemailer in Express) |
| Escalation | n8n cron | Check requests past SLA, notify managers |

---

## MongoDB Schema Design Patterns for Dynamic Fields

### Pattern: Attribute Schema with Field Definition + Embedded Values

**Do NOT use:** Generic `Map` type or fully schemaless documents. They break validation and querying.

**Do use:** A `fieldDefinitions` array on Program and a `fieldValues` Map on Request.

```typescript
// Program schema — defines what fields exist
const FieldDefinitionSchema = new Schema({
  key: { type: String, required: true },       // "priority", "department"
  label: { type: String, required: true },      // "Priority Level"
  type: { type: String, enum: ['text', 'number', 'date', 'dropdown', 'checkbox', 'file_upload'] },
  required: { type: Boolean, default: false },
  options: [String],                             // For dropdown type
  order: { type: Number },
});

const ProgramSchema = new Schema({
  name: String,
  fieldDefinitions: [FieldDefinitionSchema],
  // ...
});

// Request schema — stores actual field values
const RequestSchema = new Schema({
  program: { type: Schema.Types.ObjectId, ref: 'Program' },
  fieldValues: {
    type: Map,
    of: Schema.Types.Mixed,                     // Values validated at application layer via Zod
  },
  // ... status, assignee, etc.
});
```

**Why this pattern:**
- `fieldDefinitions` on Program acts as the schema definition — UI reads it to render form fields
- `fieldValues` as a Map allows flexible key-value storage per request
- Application-layer validation via Zod (not Mongoose) validates `fieldValues` against the program's `fieldDefinitions` at runtime
- MongoDB compound indexes on `fieldValues` keys you query frequently: `RequestSchema.index({ 'fieldValues.priority': 1 })`

### Indexing Strategy for Dynamic Fields

```typescript
// Always index the lookup patterns you use
RequestSchema.index({ program: 1, status: 1, createdAt: -1 });
RequestSchema.index({ program: 1, assignee: 1, status: 1 });
RequestSchema.index({ 'fieldValues.priority': 1 });   // Only if you filter/sort by priority
// Use MongoDB wildcard index if you need to query ANY dynamic field:
RequestSchema.index({ 'fieldValues.$**': 1 });         // MongoDB 7 supports this
```

**Warning:** Wildcard indexes are useful but have performance implications on write-heavy collections. Use targeted indexes for fields you know you'll query. Use wildcard as fallback for ad-hoc queries only.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| State management | `zustand` | Redux Toolkit | Redux is overkill for this app. Most "state" is server state (react-query handles it). Zustand covers the small amount of client-only state. |
| HTTP client | `axios` | Native `fetch` | Axios provides interceptors (critical for JWT refresh), automatic JSON transforms, and request cancellation. fetch requires manual wrappers for all of this. |
| Form library | `react-hook-form` | Formik | Formik is heavier, re-renders more, and has weaker TypeScript support. react-hook-form is the 2024-2025 standard. |
| Date library | `date-fns` | dayjs / moment | moment.js is deprecated. dayjs is fine but date-fns is more tree-shakeable (import individual functions). |
| Redis client | `ioredis` | `redis` (node-redis) | ioredis has better reconnection handling, Lua scripting, and is the de facto standard for production Node.js. |
| CSV parsing (server) | `csv-parse` | PapaParse on server | csv-parse is stream-based, handles large files without memory issues. PapaParse loads everything into memory. |
| Excel (server) | `exceljs` | SheetJS | ExcelJS streams rows (low memory). SheetJS CE loads entire workbook into memory. For large request book imports, streaming matters. |
| Logging | `winston` | `pino` | Pino is faster but winston is more mature with more transports. Either is fine. Winston chosen for ecosystem breadth. |
| Test runner | `vitest` | Jest | Vitest shares Vite's config and transform pipeline. No separate babel/ts-jest config needed. Faster for Vite projects. |
| TS runner | `tsx` | `ts-node` | tsx is faster (uses esbuild), handles ESM natively, zero-config. ts-node requires tsconfig paths and ESM workarounds. |
| PDF generation | `pdfkit` | Puppeteer/Playwright | Puppeteer launches a headless browser — massive memory/CPU overhead in Docker. pdfkit is lightweight and programmatic. |
| Password hashing | `bcryptjs` | `bcrypt` | `bcrypt` requires native compilation (node-gyp), causes Docker build issues on Alpine. `bcryptjs` is pure JS, identical API, slightly slower but negligible for auth operations. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **BullMQ / Bull** | Project constraint: n8n replaces all background job processing. Adding BullMQ creates a parallel job system that duplicates n8n's purpose. | n8n workflows triggered via webhooks |
| **node-cron / cron** | Project constraint: n8n handles all scheduled tasks. In-process cron is unreliable (dies with the process) and duplicates n8n. | n8n Schedule trigger node |
| **nodemailer** | Project constraint: n8n handles all email. Putting email logic in Express means maintaining templates, SMTP config, and retry logic in two places. | n8n Email Send node |
| **moment.js** | Deprecated by its own maintainers since 2020. Massive bundle size (300KB+). | `date-fns` (tree-shakeable, ~5KB per function) |
| **Redux Toolkit** | Overkill. This app's client state is minimal (most state is server state managed by react-query). Redux adds boilerplate, slices, and complexity for no benefit here. | `zustand` for client state, `@tanstack/react-query` for server state |
| **Formik** | Heavier, more re-renders, weaker TypeScript inference than react-hook-form. Lost the ecosystem race. | `react-hook-form` |
| **Create React App (CRA)** | Deprecated. No longer maintained. Slow builds. | Vite (already in stack) |
| **Sequelize / TypeORM** | SQL ORMs. We use MongoDB. | Mongoose |
| **Puppeteer for PDF** | Launches a full Chrome instance per PDF. 500MB+ memory per instance. Unacceptable in a Docker Compose setup with 7 containers. | `pdfkit` for programmatic PDFs |
| **ts-node** | Slow startup, ESM compatibility issues, requires complex tsconfig. | `tsx` (esbuild-based, zero-config) |
| **bcrypt** (native) | Requires `node-gyp`, Python, and build tools in Docker. Breaks on Alpine without `--build-from-source`. | `bcryptjs` (pure JS, same API) |
| **Tailwind CSS v4** | Breaking changes from v3. Config format changed. shadcn/ui and most plugins still target v3. | Tailwind CSS v3.4.x |
| **React 19** | Needs verification that shadcn/ui, react-hook-form, react-router-dom, and other deps are fully compatible. Do not adopt until verified. | React 18.3.x |
| **Express 5** | Still in RC. Middleware ecosystem not fully compatible. Error handling semantics changed. | Express 4.21.x |
| **Zod 4** | May be in preview/beta. API changes from v3. Ecosystem (react-hook-form resolvers, etc.) targets v3. | Zod 3.23.x |

---

## Stack Patterns

**Monorepo structure (recommended):**
```
rms_proj/
  packages/
    shared/           # Zod schemas, types, constants shared between FE and BE
      src/
        schemas/      # Zod validation schemas
        types/        # TypeScript interfaces
        constants/    # Shared enums, status maps
  client/             # React + Vite frontend
  server/             # Express + Mongoose backend
  docker/             # Dockerfiles
  n8n/                # n8n workflow exports (JSON)
  docker-compose.yml
```

**If using npm workspaces:**
- Define `workspaces: ["packages/*", "client", "server"]` in root `package.json`
- Shared package referenced as `"@rms/shared": "workspace:*"` in client and server

**If NOT using workspaces (simpler):**
- Put shared Zod schemas in `server/src/shared/` and import into client via path alias
- Or copy types at build time

**Recommendation:** Start without workspaces. Add npm workspaces only if the shared code grows beyond a few schema files.

---

## Version Compatibility Matrix

| Package A | Must Be Compatible With | Notes |
|-----------|------------------------|-------|
| `socket.io` server | `socket.io-client` | MUST be same major version (both 4.x). Mismatched major versions = silent connection failures. |
| `mongoose` 8.x | MongoDB 7.0 | Mongoose 8 supports MongoDB 5.0+. Full compatibility. |
| `@tanstack/react-query` 5.x | React 18.x | Fully compatible. |
| `@tanstack/react-table` 8.x | React 18.x | Fully compatible. Headless — no UI dependency. |
| `react-hook-form` 7.x | `@hookform/resolvers` 3.x + `zod` 3.x | These three must be used together. Resolver version must match form version. |
| `shadcn/ui` | `tailwind` 3.x + `lucide-react` + `class-variance-authority` + `clsx` + `tailwind-merge` | shadcn/ui init installs these as peer deps. Do not remove or replace them. |
| `vite` 6.x | `@vitejs/plugin-react-swc` 3.x | Compatible. If using Vite 5.x fallback, use plugin-react-swc 3.x as well. |
| `passport` 0.7.x | `passport-jwt` 4.x + `passport-local` 1.x | Passport 0.7 changed session serialization. These strategy versions are compatible. |
| `ioredis` 5.x | Redis 7.2 | Full compatibility. |
| `@socket.io/redis-adapter` 8.x | `ioredis` 5.x + `socket.io` 4.x | All three must be used together for multi-instance Socket.IO. |

---

## Installation Commands

```bash
# ==========================================
# CLIENT (React + Vite)
# ==========================================

# Core
npm install react@~18.3.1 react-dom@~18.3.1

# Routing & State
npm install react-router-dom@~7.0 @tanstack/react-query@~5.62 zustand@~5.0

# Forms & Validation
npm install react-hook-form@~7.54 @hookform/resolvers@~3.9 zod@~3.23

# Tables & Charts
npm install @tanstack/react-table@~8.20 recharts@~2.14

# HTTP & Real-time
npm install axios@~1.7 socket.io-client@~4.8

# File handling
npm install react-dropzone@~14.3 xlsx@~0.18.5 papaparse@~5.4

# Date
npm install date-fns@~4.1

# Dev dependencies
npm install -D typescript@~5.6 vite@~6.0 @vitejs/plugin-react-swc@~3.7
npm install -D tailwindcss@~3.4 postcss autoprefixer
npm install -D @types/react @types/react-dom
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D eslint prettier eslint-config-prettier

# shadcn/ui (run after project init)
npx shadcn@latest init --style new-york

# ==========================================
# SERVER (Express + Mongoose)
# ==========================================

# Core
npm install express@~4.21 mongoose@~8.9 zod@~3.23

# Auth
npm install passport@~0.7 passport-jwt@~4.0.1 passport-local@~1.0.0
npm install jsonwebtoken@~9.0 bcryptjs@~2.4.3 cookie-parser@~1.4.7

# Real-time
npm install socket.io@~4.8

# Redis
npm install ioredis@~5.4
npm install @socket.io/redis-adapter@~8.3

# Security & Middleware
npm install cors@~2.8.5 helmet@~8.0 compression@~1.7.5
npm install express-rate-limit@~7.4 rate-limit-redis@~4.2
npm install morgan@~1.10

# File handling
npm install multer@~1.4.5-lts.1 csv-parse@~5.6 exceljs@~4.4

# PDF
npm install pdfkit@~0.15

# Utilities
npm install nanoid@~5.0 uuid@~10.0 dotenv@~16.4 winston@~3.17

# HTTP client (for n8n webhooks)
npm install axios@~1.7

# Dev dependencies
npm install -D typescript@~5.6 tsx@~4.19
npm install -D @types/express @types/passport @types/passport-jwt @types/passport-local
npm install -D @types/jsonwebtoken @types/bcryptjs @types/cookie-parser
npm install -D @types/cors @types/compression @types/morgan @types/multer @types/uuid
npm install -D vitest supertest @types/supertest
npm install -D eslint prettier eslint-config-prettier
npm install -D husky@~9.1 lint-staged@~15.2 concurrently@~9.1
```

---

## Docker Compose Service Map

```yaml
services:
  mongo:        # mongo:7.0              — port 27017
  redis:        # redis:7.2-alpine       — port 6379
  postgres:     # postgres:16-alpine     — port 5432 (n8n only)
  n8n:          # n8nio/n8n:latest        — port 5678
  server:       # node:20-alpine (custom) — port 3001
  client:       # node:20-alpine (build)  — served by nginx
  nginx:        # nginx:1.27-alpine       — port 80/443
```

**Total: 7 containers.** This is the ceiling. Do not add more services (no Elasticsearch, no RabbitMQ, no separate worker containers).

---

## Sources

- **Training data (May 2025):** All version numbers and library recommendations are based on Claude's training data. Confidence is LOW-MEDIUM for specific version numbers.
- **Verification needed:** Before starting development, run `npm view <package> version` for each core package to confirm latest stable versions.
- **shadcn/ui:** https://ui.shadcn.com/docs — copy-paste component model confirmed as of training data.
- **n8n:** https://docs.n8n.io/ — webhook trigger node and self-hosted Docker deployment patterns confirmed.
- **MongoDB wildcard indexes:** https://www.mongodb.com/docs/manual/core/index-wildcard/ — available since MongoDB 4.2, enhanced in 7.0.
- **Mongoose 8 TypeScript:** https://mongoosejs.com/docs/typescript.html — improved generics in v8.

**Important disclaimer:** WebSearch, WebFetch, and Bash tools were all unavailable during this research session. All version numbers come from training data (cutoff May 2025) and may be outdated by 9+ months. Verify every version against `npm view <pkg> version` before locking `package.json`.

---
*Stack research for: Request Management System with n8n Automation*
*Researched: 2026-02-20*
