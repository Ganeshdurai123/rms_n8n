# RMS (Request Management System) — Complete Project Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Getting Started (Setup from Scratch)](#5-getting-started-setup-from-scratch)
6. [Environment Variables](#6-environment-variables)
7. [Backend (Server)](#7-backend-server)
8. [Frontend (Client)](#8-frontend-client)
9. [n8n Workflow Automation](#9-n8n-workflow-automation)
10. [Docker & Nginx](#10-docker--nginx)
11. [Database Models](#11-database-models)
12. [API Reference](#12-api-reference)
13. [Authentication & Authorization](#13-authentication--authorization)
14. [Real-Time (Socket.IO)](#14-real-time-socketio)
15. [Key Design Patterns](#15-key-design-patterns)

---

## 1. Project Overview

RMS is a full-stack **Request Management System** that allows organizations to:

- Create **Programs** (containers for related work)
- Submit, track, and manage **Requests** through a configurable lifecycle
- Assign requests to team members with role-based access control
- Get **email notifications** and **in-app notifications** via n8n automation
- Generate **reports** (summary, program, overdue)
- Import/export requests via **CSV**
- Track all changes via an immutable **audit trail**
- View requests in **sheet**, **calendar**, and **detail** views
- Create **sequential request chains** (workflow dependencies)

### Default Admin Credentials (first boot)

| Field    | Value            |
|----------|------------------|
| Email    | `admin@rms.local`|
| Password | `Admin123!@#`    |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Nginx (port 80)                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  /api/*  ────────┼──► Express (5000)   │  │ /api/v1/      │ │
│  │  /socket.io/* ───┼──►                  │  │ internal/*    │ │
│  │  /* ─────────────┼──► React (3000)     │  │ ──► 403 BLOCK │ │
│  └──────────────────┘  └────────┬─────────┘  └───────────────┘ │
└─────────────────────────────────┼───────────────────────────────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
     ┌─────▼─────┐         ┌─────▼─────┐         ┌──────▼──────┐
     │  MongoDB   │         │   Redis   │         │ Socket.IO   │
     │  (27017)   │         │  (6379)   │         │ (real-time) │
     └───────────┘         └───────────┘         └─────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │    Webhook Outbox (10s)    │
                    └─────────────┬─────────────┘
                                  │
                           ┌──────▼──────┐
                           │  n8n (5678) │──► SMTP Email
                           │  PostgreSQL │
                           └─────────────┘
```

### Communication Flow

1. **User** interacts with **React Frontend** (port 3000)
2. Frontend calls **Express API** via Nginx reverse proxy (port 80)
3. Express reads/writes **MongoDB** and caches in **Redis**
4. On mutations, Express enqueues webhook events into MongoDB outbox
5. **Outbox processor** (every 10s) sends events to **n8n** via HTTP
6. **n8n** sends emails via SMTP and creates in-app notifications via internal API
7. **Socket.IO** pushes real-time updates to connected clients

---

## 3. Tech Stack

### Backend
| Technology  | Purpose                           |
|-------------|-----------------------------------|
| Node.js 20  | Runtime                           |
| Express 4   | HTTP framework                    |
| TypeScript   | Type safety                      |
| MongoDB 7.0 | Primary database (Mongoose ODM)  |
| Redis 7.2   | Caching layer (ioredis)          |
| Socket.IO 4 | Real-time WebSocket events       |
| Passport.js | JWT authentication strategy      |
| Zod          | Request validation & env parsing |
| Winston     | Structured logging               |
| Multer      | File upload handling             |
| XLSX        | Excel/CSV import processing      |
| Helmet      | Security headers                 |
| bcryptjs    | Password hashing                 |

### Frontend
| Technology      | Purpose                        |
|-----------------|--------------------------------|
| React 18        | UI framework                   |
| TypeScript       | Type safety                   |
| Vite            | Build tool & dev server        |
| React Router v6 | Client-side routing           |
| Axios           | HTTP client                    |
| Socket.IO Client| Real-time subscriptions       |
| Tailwind CSS    | Utility-first styling         |
| shadcn/ui       | Component library (Radix UI)  |
| Lucide React    | Icon library                   |
| Sonner          | Toast notifications            |

### Infrastructure
| Technology    | Purpose                          |
|---------------|----------------------------------|
| Docker Compose| Container orchestration         |
| Nginx 1.27   | Reverse proxy & routing          |
| n8n           | Workflow automation (email/reports)|
| PostgreSQL 16 | n8n's database                   |

---

## 4. Project Structure

```
rms_proj/
├── client/                          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui components (Button, Card, Dialog, etc.)
│   │   │   ├── layout/              # AppLayout, Header, Sidebar
│   │   │   ├── sheet/               # SheetTable, SheetToolbar, SheetPagination
│   │   │   ├── request/             # RequestInfo, CommentTimeline, AttachmentList
│   │   │   ├── calendar/            # CalendarGrid
│   │   │   ├── import/              # FileUpload, ColumnMapping, ValidationPreview
│   │   │   ├── NotificationBell.tsx
│   │   │   └── BoundaryStatsPanel.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── ProgramListPage.tsx
│   │   │   ├── SheetViewPage.tsx
│   │   │   ├── RequestDetailPage.tsx
│   │   │   ├── CalendarViewPage.tsx
│   │   │   ├── ImportWizardPage.tsx
│   │   │   ├── ImportHistoryPage.tsx
│   │   │   ├── ReportsPage.tsx
│   │   │   ├── ReportDetailPage.tsx
│   │   │   ├── NotificationsPage.tsx
│   │   │   ├── UserManagementPage.tsx
│   │   │   └── ComplianceReviewPage.tsx
│   │   ├── hooks/
│   │   │   ├── useSheetData.ts       # Pagination, sort, filter state
│   │   │   ├── useCalendarData.ts    # Calendar data fetching
│   │   │   └── useSocket.ts          # Socket.IO event subscription
│   │   ├── lib/
│   │   │   ├── api.ts               # Axios instance + JWT interceptors
│   │   │   ├── auth.tsx             # AuthContext + AuthProvider
│   │   │   ├── socket.ts           # Socket.IO connection manager
│   │   │   ├── types.ts            # TypeScript interfaces
│   │   │   └── utils.ts            # cn(), formatters
│   │   ├── App.tsx                  # Routes + providers
│   │   └── main.tsx                 # Entry point
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── server/                          # Express backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts              # Zod-validated environment variables
│   │   │   ├── database.ts         # MongoDB connection
│   │   │   ├── redis.ts            # Redis connection + helpers
│   │   │   ├── socket.ts           # Socket.IO initialization
│   │   │   ├── passport.ts         # JWT strategy
│   │   │   ├── logger.ts           # Winston logger
│   │   │   └── seed.ts             # Admin user seeder
│   │   ├── middleware/
│   │   │   ├── authenticate.ts     # JWT token verification
│   │   │   ├── authorize.ts        # Role-based access control
│   │   │   └── internalAuth.ts     # x-api-key for n8n internal API
│   │   ├── modules/
│   │   │   ├── auth/               # Login, register, refresh, logout
│   │   │   │   ├── auth.model.ts   # User model
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.routes.ts
│   │   │   │   └── auth.schema.ts  # Zod validation
│   │   │   ├── program/            # Program CRUD
│   │   │   │   ├── program.model.ts
│   │   │   │   ├── program.controller.ts
│   │   │   │   ├── program.service.ts
│   │   │   │   ├── program.routes.ts
│   │   │   │   └── program.schema.ts
│   │   │   ├── request/            # Request CRUD + comments + attachments
│   │   │   │   ├── request.model.ts
│   │   │   │   ├── request.service.ts
│   │   │   │   ├── request.controller.ts
│   │   │   │   ├── request.routes.ts
│   │   │   │   ├── request.schema.ts
│   │   │   │   ├── stateMachine.ts # Status transition rules
│   │   │   │   ├── comment.model.ts
│   │   │   │   ├── comment.service.ts
│   │   │   │   ├── comment.controller.ts
│   │   │   │   ├── comment.routes.ts
│   │   │   │   ├── attachment.model.ts
│   │   │   │   ├── attachment.service.ts
│   │   │   │   ├── attachment.controller.ts
│   │   │   │   ├── attachment.routes.ts
│   │   │   │   ├── import.controller.ts  # CSV import
│   │   │   │   └── import.routes.ts
│   │   │   ├── user/               # User management (admin)
│   │   │   │   ├── programMember.model.ts
│   │   │   │   ├── user.controller.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   ├── user.routes.ts
│   │   │   │   └── user.schema.ts
│   │   │   ├── notification/       # In-app notifications
│   │   │   │   ├── notification.model.ts
│   │   │   │   ├── notification.service.ts
│   │   │   │   ├── notification.controller.ts
│   │   │   │   └── notification.routes.ts
│   │   │   ├── webhook/            # Outbox pattern for n8n
│   │   │   │   ├── webhook.service.ts
│   │   │   │   ├── webhook.types.ts
│   │   │   │   └── webhookEvent.model.ts
│   │   │   ├── audit/              # Immutable audit trail
│   │   │   │   ├── auditLog.model.ts
│   │   │   │   ├── audit.utils.ts
│   │   │   │   ├── audit.controller.ts
│   │   │   │   └── audit.routes.ts
│   │   │   ├── chain/              # Sequential request chains
│   │   │   │   ├── chain.model.ts
│   │   │   │   ├── chain.service.ts
│   │   │   │   ├── chain.controller.ts
│   │   │   │   └── chain.routes.ts
│   │   │   ├── report/             # Report generation
│   │   │   │   ├── report.model.ts
│   │   │   │   ├── report.service.ts
│   │   │   │   ├── report.controller.ts
│   │   │   │   └── report.routes.ts
│   │   │   └── internal/           # n8n internal API
│   │   │       ├── internal.controller.ts
│   │   │       └── internal.routes.ts
│   │   ├── shared/
│   │   │   ├── errors.ts           # Custom error classes
│   │   │   ├── cache.ts            # Redis cache helpers
│   │   │   ├── types.ts            # Shared type definitions
│   │   │   └── socketEvents.ts     # Socket event type catalog
│   │   ├── app.ts                  # Express app setup
│   │   └── server.ts               # Server entry point
│   ├── n8n-workflows/              # Active n8n workflow JSONs
│   │   ├── Due Date Reminders.json
│   │   └── Report Generation.json
│   ├── uploads/                    # File attachment storage
│   └── package.json
│
├── n8n/                            # n8n workflow templates
│   └── workflows/
│       ├── email-notification.json
│       └── scheduled-reminder.json
│
├── docker/
│   ├── server/Dockerfile
│   ├── client/Dockerfile
│   └── nginx/
│       ├── nginx.conf
│       └── default.conf
│
├── docker-compose.yml
├── .env                            # Environment variables
├── .env.example                    # Template
├── APP_USER_GUIDE.md
├── N8N_SETUP_GUIDE.md
└── RMS_WORKFLOW_FLOW.md
```

---

## 5. Getting Started (Setup from Scratch)

### Prerequisites

- **Node.js 20+**
- **Docker** and **Docker Compose**
- **Git**

### Step 1: Clone and configure environment

```bash
git clone <repo-url>
cd rms_proj
cp .env.example .env
```

Edit `.env` with your secrets (see [Section 6](#6-environment-variables)).

### Step 2: Start all services with Docker

```bash
docker-compose up -d
```

This starts 7 services:
| Service      | Port  | Purpose                      |
|--------------|-------|------------------------------|
| `rms_mongo`  | 27017 | MongoDB database             |
| `rms_redis`  | 6379  | Redis cache                  |
| `rms_n8n_db` | 5432  | PostgreSQL (for n8n)         |
| `rms_n8n`    | 5678  | n8n automation engine        |
| `rms_server` | 5000  | Express API                  |
| `rms_client` | 3000  | React frontend               |
| `rms_nginx`  | 80    | Reverse proxy (entry point)  |

### Step 3: Access the application

- **App:** http://localhost (via Nginx)
- **n8n UI:** http://localhost:5678
- **API health:** http://localhost/api/v1/health

### Step 4: Login with default admin

- Email: `admin@rms.local`
- Password: `Admin123!@#`

### Step 5: Configure n8n (for email notifications)

1. Open http://localhost:5678
2. Go to **Credentials > Add Credential > Header Auth**
   - Name: `x-api-key`
   - Value: same as `INTERNAL_API_KEY` in `.env`
3. Add an **SMTP Credential** (Gmail, SendGrid, etc.)
4. **Import workflows** from `n8n/workflows/` directory
5. Configure SMTP in each email node
6. **Activate** the workflows

### Local development (without Docker)

```bash
# Terminal 1: Start MongoDB and Redis (or use Docker for just these)
docker-compose up -d mongo redis

# Terminal 2: Start backend
cd server
npm install
npm run dev        # Runs on port 5000

# Terminal 3: Start frontend
cd client
npm install
npm run dev        # Runs on port 3000
```

Frontend proxies `/api/v1` and `/socket.io` to `localhost:5000` via Vite config.

---

## 6. Environment Variables

| Variable | Required | Default | Min Length | Description |
|----------|----------|---------|-----------|-------------|
| `MONGO_URI` | Yes | — | — | MongoDB connection string |
| `REDIS_URL` | Yes | — | — | Redis connection string |
| `JWT_ACCESS_SECRET` | Yes | — | 32 | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Yes | — | 32 | Secret for signing refresh tokens |
| `JWT_ACCESS_EXPIRY` | No | `15m` | — | Access token TTL |
| `JWT_REFRESH_EXPIRY` | No | `7d` | — | Refresh token TTL |
| `PORT` | No | `5000` | — | Express server port |
| `NODE_ENV` | No | `development` | — | `development` / `production` / `test` |
| `CLIENT_URL` | No | `http://localhost` | — | Frontend URL (used in email links) |
| `N8N_DB_PASSWORD` | Yes | — | — | PostgreSQL password for n8n |
| `N8N_USER` | Yes | — | — | n8n web UI username |
| `N8N_PASSWORD` | Yes | — | — | n8n web UI password |
| `N8N_WEBHOOK_BASE_URL` | No | — | — | n8n webhook URL (e.g., `http://n8n:5678/webhook`) |
| `N8N_WEBHOOK_SECRET` | No | — | — | Shared secret for webhook auth |
| `INTERNAL_API_KEY` | Yes | — | 32 | API key for n8n → Express internal calls |

---

## 7. Backend (Server)

### 7.1 Boot Sequence (`server.ts`)

1. Validate environment variables (Zod schema in `env.ts`)
2. Connect to MongoDB (`database.ts`)
3. Seed default admin user if none exists (`seed.ts`)
4. Verify Redis connectivity (`redis.ts`)
5. Create HTTP server and initialize Socket.IO (`socket.ts`)
6. Start webhook outbox processor (polls every 10s)
7. Listen on configured PORT
8. Register graceful shutdown handlers (SIGINT/SIGTERM)

### 7.2 Middleware Chain (`app.ts`)

```
Request → Helmet → CORS → Compression → JSON Parser → URL Parser
        → Cookie Parser → Morgan (dev) → Passport Init → Routes
        → Error Handler
```

### 7.3 Module Architecture

Each module follows a consistent pattern:

```
module/
├── model.ts       # Mongoose schema + TypeScript interface
├── schema.ts      # Zod validation schemas
├── service.ts     # Business logic (DB queries, cache, events)
├── controller.ts  # HTTP handlers (parse req, call service, send res)
└── routes.ts      # Express router with middleware
```

### 7.4 Modules Overview

| Module | Purpose |
|--------|---------|
| **auth** | Registration, login, JWT tokens, refresh, logout |
| **program** | Program CRUD, field definitions, settings, timeframes |
| **request** | Request CRUD, status transitions, assignment, CSV export |
| **request/comment** | Comment CRUD on requests |
| **request/attachment** | File upload/download/delete (Multer) |
| **request/import** | CSV upload, column mapping, validation, execution |
| **user** | User CRUD (admin), program member management |
| **notification** | In-app notifications, mark read, list |
| **webhook** | Outbox pattern for n8n event dispatch |
| **audit** | Immutable audit trail for all mutations |
| **chain** | Sequential request chains with auto-progression |
| **report** | Report job creation, generation, completion |
| **internal** | Protected API for n8n (health, notifications, reminders, reports) |

### 7.5 Request Status State Machine

```
                    ┌──────────┐
                    │  draft   │
                    └────┬─────┘
                         │ submit (creator only)
                    ┌────▼─────┐
              ┌─────┤submitted │
              │     └────┬─────┘
              │          │ review
              │     ┌────▼─────┐
              │     │in_review │──────────┐
              │     └────┬─────┘          │
              │          │                │
         reject     approve          reject
              │          │                │
              │     ┌────▼─────┐          │
              │     │ approved │          │
              │     └────┬─────┘          │
              │          │ complete       │
              │     ┌────▼─────┐     ┌────▼─────┐
              └────►│ rejected │     │completed │
                    └──────────┘     └──────────┘
                         │ resubmit
                         └──────► submitted
```

**Role permissions for transitions:**

| Transition | Allowed Roles |
|------------|---------------|
| draft → submitted | creator only |
| submitted → in_review | admin, manager, team_member |
| in_review → approved | admin, manager |
| in_review → rejected | admin, manager |
| approved → completed | admin, manager |
| rejected → submitted | creator only (resubmit) |

### 7.6 Caching Strategy

- **Redis** with `ioredis`
- Individual request cache: `requests:{id}` (TTL: 5 min)
- List cache: `requests:list:*` (pattern invalidation)
- Cache-aside pattern: check cache → miss → query DB → populate cache
- Invalidation on every write operation

---

## 8. Frontend (Client)

### 8.1 Routing

| Route | Page | Access |
|-------|------|--------|
| `/login` | LoginPage | Public |
| `/programs` | ProgramListPage | Authenticated |
| `/programs/:id/sheet` | SheetViewPage | Authenticated |
| `/programs/:id/requests/:reqId` | RequestDetailPage | Authenticated |
| `/programs/:id/calendar` | CalendarViewPage | Authenticated |
| `/programs/:id/import` | ImportWizardPage | Authenticated |
| `/programs/:id/import/history` | ImportHistoryPage | Authenticated |
| `/programs/:id/compliance-review` | ComplianceReviewPage | Authenticated |
| `/reports` | ReportsPage | Authenticated |
| `/reports/:reportId` | ReportDetailPage | Authenticated |
| `/notifications` | NotificationsPage | Authenticated |
| `/admin/users` | UserManagementPage | Admin only |

### 8.2 Authentication Flow

1. User enters email/password on `/login`
2. `POST /api/v1/auth/login` returns `{ accessToken, user }`
3. Access token stored **in memory** (not localStorage — security)
4. Refresh token stored as **httpOnly cookie** (set by server)
5. Axios interceptor adds `Authorization: Bearer <token>` to all requests
6. On 401, interceptor calls `POST /api/v1/auth/refresh` automatically
7. Failed requests queued and retried with new token
8. `AuthProvider` wraps app, provides `user`, `login()`, `logout()`
9. `ProtectedRoute` redirects to `/login` if not authenticated

### 8.3 Key Features

**Sheet View (main work view)**
- Spreadsheet-style table with inline create/edit
- Dynamic columns based on program field definitions
- Sortable headers, debounced search (300ms)
- Filters: status, priority, assignee, date range, custom fields
- Row actions: edit, delete, assign, change status
- CSV export
- Real-time updates via Socket.IO

**Request Detail**
- Full request info with status/priority badges
- Tabbed interface: Comments, Attachments, Audit History
- Comment timeline with avatars and relative timestamps
- File upload/download with size display
- Complete audit trail (who changed what, when)
- Chain status panel (if part of a workflow chain)

**Notification System**
- Bell icon in header with unread count badge
- Dropdown showing 10 most recent notifications
- Full notifications page with pagination
- Mark individual or all as read
- Real-time push via Socket.IO + 30s polling fallback

**Report Generation**
- Three report types: Summary, Program, Overdue
- Async generation: pending → processing → completed
- Auto-poll every 10s while pending
- Instant update on `report:completed` socket event
- Visualized results: charts, breakdowns, tables

**Import Wizard (4 steps)**
1. Upload CSV file (drag-drop or click)
2. Map CSV columns to program fields
3. Preview validation results (errors per row)
4. Execute import with success/error summary

**Calendar View**
- Month/week toggle
- Requests displayed on their due dates
- Navigation: prev/next/today

### 8.4 Socket.IO Integration

```typescript
// Connection with JWT auth
socket = io(window.location.origin, {
  auth: { token, lastEventTimestamp },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
});
```

**Events subscribed:**
- `request:created`, `request:updated`, `request:status_changed`
- `request:assigned`, `request:deleted`
- `comment:added`, `comment:deleted`
- `attachment:uploaded`, `attachment:deleted`
- `notification:created`
- `report:completed`

---

## 9. n8n Workflow Automation

### 9.1 How it works

Express backend enqueues webhook events into a MongoDB outbox collection. Every 10 seconds, the outbox processor sends pending events to n8n via HTTP POST to `N8N_WEBHOOK_BASE_URL/{eventType}`. n8n processes the events, sends emails via SMTP, and creates in-app notifications via the Express internal API.

### 9.2 Workflows

#### Workflow 1: Email Notification Dispatch
**File:** `n8n/workflows/email-notification.json`
**Trigger:** Webhook (`POST /webhook/rms-events`)

Handles 3 event types:

| Event | Email Recipient | Subject |
|-------|----------------|---------|
| `request.status_changed` | Assignee (fallback: creator) | "Request status changed: {title}" |
| `request.assigned` | Assignee only | "You have been assigned: {title}" |
| `comment.added` | Assignee (fallback: creator) | "New comment on: {title}" |

After sending email, creates an in-app notification via `POST /api/v1/internal/notifications`.

#### Workflow 2: Scheduled Reminder
**File:** `n8n/workflows/scheduled-reminder.json`
**Trigger:** Cron (`0 9 * * *` — daily at 9 AM UTC)

1. Fetches stale requests from `GET /api/v1/internal/pending-reminders`
2. For each: sends reminder email + creates in-app notification
3. Targets: requests in `submitted`/`in_review` status past due date or due within 24h

#### Workflow 3: Due Date Reminders
**File:** `server/n8n-workflows/Due Date Reminders.json`
**Trigger:** Cron (`0 8 * * *` — daily at 8 AM)
**Status:** Active

1. Fetches overdue requests (`?type=overdue`)
2. Fetches upcoming requests (`?type=upcoming`)
3. Merges and sends color-coded emails:
   - **Red** header for overdue: `"[RMS] OVERDUE: {title} (X days overdue)"`
   - **Amber** header for upcoming: `"[RMS] Reminder: {title} (Due: {date})"`

#### Workflow 4: Report Generation
**File:** `server/n8n-workflows/Report Generation.json`
**Trigger:** Webhook (`POST /webhook/report.requested`)
**Status:** Active

1. Receives `reportId` from Express
2. Fetches report data via `GET /api/v1/internal/report-data?reportId=...`
3. Posts results back via `POST /api/v1/internal/report-complete`

### 9.3 Webhook Event Types

```typescript
'request.created'      // New request
'request.updated'      // Request fields modified
'request.status_changed' // Status transition
'request.assigned'     // Assignee changed
'request.deleted'      // Request deleted
'comment.added'        // Comment posted
'comment.deleted'      // Comment removed
'attachment.uploaded'  // File attached
'attachment.deleted'   // Attachment removed
'report.requested'     // Report generation triggered
```

### 9.4 Security

| Direction | Authentication |
|-----------|---------------|
| Express → n8n | `x-webhook-secret` header |
| n8n → Express | `x-api-key` header (matches `INTERNAL_API_KEY`) |
| External → Internal API | Blocked by Nginx (403) |

---

## 10. Docker & Nginx

### 10.1 Docker Services

```yaml
services:
  mongo:        # MongoDB 7.0        → port 27017
  redis:        # Redis 7.2 Alpine   → port 6379
  n8n_db:       # PostgreSQL 16      → port 5432
  n8n:          # n8n:latest         → port 5678
  server:       # Express (tsx watch)→ port 5000
  client:       # Vite dev server    → port 3000
  nginx:        # Nginx 1.27 Alpine  → port 80

volumes:
  mongo_data, redis_data, n8n_db_data, n8n_data

networks:
  rms_network (bridge)
```

All services have health checks. Dependencies ensure boot order:
`mongo/redis` → `server` → `client` → `nginx`

### 10.2 Nginx Routing

| Location | Destination | Notes |
|----------|-------------|-------|
| `/api/v1/internal/*` | **403 Forbidden** | Blocks external access to internal API |
| `/api/*` | Express (5000) | Public API routes |
| `/socket.io/*` | Express (5000) | WebSocket upgrade support |
| `/*` | React (3000) | Frontend SPA |

### 10.3 Dockerfiles

**Server** (`docker/server/Dockerfile`):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5000
CMD ["npx", "tsx", "watch", "src/server.ts"]
```

**Client** (`docker/client/Dockerfile`):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

---

## 11. Database Models

### User (`auth.model.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `email` | String | Unique, lowercase, validated |
| `password` | String | bcrypt hashed, `select: false` |
| `firstName` | String | Required |
| `lastName` | String | Required |
| `role` | Enum | `admin`, `manager`, `team_member`, `client` |
| `isActive` | Boolean | Default: true |
| `createdAt` | Date | Auto |
| `updatedAt` | Date | Auto |

### Program (`program.model.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `name` | String | 3-100 chars |
| `description` | String | Max 2000 chars |
| `fieldDefinitions` | Array | `[{ key, label, type, required, options[], order }]` |
| `settings` | Object | `{ allowClientSubmission, requireApproval, maxActiveRequests, maxActivePerUser }` |
| `timeframes` | Object | `{ submissionStart, submissionEnd, reviewDeadline }` |
| `dueDateConfig` | Object | `{ enabled, defaultOffsetDays, sourceField, basedOn }` |
| `complianceType` | String | Optional |
| `status` | Enum | `active`, `archived`, `draft` |
| `createdBy` | ObjectId → User | Required |

### Request (`request.model.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `programId` | ObjectId → Program | Required, indexed |
| `title` | String | 3-200 chars |
| `description` | String | Max 5000 chars |
| `status` | Enum | `draft`→`submitted`→`in_review`→`approved`/`rejected`→`completed` |
| `fields` | Map<String, Mixed> | Dynamic fields matching program's fieldDefinitions |
| `createdBy` | ObjectId → User | Required, indexed |
| `assignedTo` | ObjectId → User | Optional, indexed |
| `priority` | Enum | `low`, `medium`, `high`, `urgent` |
| `dueDate` | Date | Auto-computed or manual |
| `chainId` | ObjectId → RequestChain | Optional |
| `chainSequence` | Number | Order in chain |

### Comment (`comment.model.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `requestId` | ObjectId → Request | Required |
| `authorId` | ObjectId → User | Required |
| `content` | String | 1-5000 chars |
| `createdAt` | Date | Auto |

### Attachment (`attachment.model.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `requestId` | ObjectId → Request | Required |
| `filename` | String | Original filename |
| `storagePath` | String | Path on disk |
| `mimeType` | String | File MIME type |
| `size` | Number | Bytes |
| `uploadedBy` | ObjectId → User | Required |

### Notification (`notification.model.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `userId` | ObjectId → User | Recipient |
| `type` | Enum | `request.status_changed`, `request.assigned`, `request.created`, `request.updated`, `comment.added`, `attachment.uploaded`, `reminder` |
| `title` | String | Display title |
| `message` | String | Display message |
| `isRead` | Boolean | Default: false |
| `programId` | String | Optional context |
| `requestId` | String | Optional context |
| `metadata` | Object | Extra data |

### AuditLog (`auditLog.model.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `action` | String | e.g., `request.created`, `request.status_changed` |
| `entityType` | String | `request`, `comment`, `attachment`, `program` |
| `entityId` | String | ID of affected entity |
| `requestId` | String | Optional |
| `programId` | String | Optional |
| `performedBy` | ObjectId → User | Who did it |
| `before` | Object | State before change |
| `after` | Object | State after change |
| `metadata` | Object | Extra context |
| `createdAt` | Date | Immutable timestamp |

### WebhookEvent (`webhookEvent.model.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `eventType` | String | One of 10 webhook event types |
| `payload` | Object | Full webhook payload |
| `status` | Enum | `pending`, `sent`, `failed` |
| `retryCount` | Number | Default: 0 |
| `maxRetries` | Number | Default: 5 |
| `lastError` | String | Error message on failure |
| `nextRetryAt` | Date | Exponential backoff schedule |
| `sentAt` | Date | When successfully delivered |

### RequestChain (`chain.model.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `programId` | ObjectId → Program | Required |
| `name` | String | Chain name |
| `steps` | Array | `[{ requestId, sequence, status }]` |
| `currentStep` | Number | Active step index |
| `createdBy` | ObjectId → User | Required |

### ReportJob (`report.model.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `type` | Enum | `summary`, `program`, `overdue` |
| `status` | Enum | `pending`, `processing`, `completed`, `failed` |
| `params` | Object | Report parameters (date range, filters) |
| `result` | Object | Generated report data |
| `programId` | ObjectId → Program | Optional (for program reports) |
| `requestedBy` | ObjectId → User | Who requested it |
| `error` | String | Error message if failed |
| `completedAt` | Date | When finished |

### ProgramMember (`programMember.model.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Auto-generated |
| `userId` | ObjectId → User | Required |
| `programId` | ObjectId → Program | Required |
| `role` | Enum | `manager`, `team_member`, `client` |
| `addedBy` | ObjectId → User | Who added them |
| `isActive` | Boolean | Default: true |

---

## 12. API Reference

### Authentication (`/api/v1/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/register` | No | Register new user |
| `POST` | `/login` | No | Login, returns access token + sets refresh cookie |
| `POST` | `/refresh` | Cookie | Refresh access token |
| `POST` | `/logout` | Cookie | Clear refresh token |
| `GET` | `/me` | JWT | Get current user profile |

### Users (`/api/v1/users`) — Admin only

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List all users (with pagination, search, role filter) |
| `POST` | `/` | Create new user |
| `GET` | `/:id` | Get user by ID |
| `PATCH` | `/:id` | Update user |
| `PATCH` | `/:id/deactivate` | Deactivate user |
| `PATCH` | `/:id/activate` | Activate user |
| `DELETE` | `/:id/permanent` | Permanently delete user |

### Programs (`/api/v1/programs`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | JWT | List programs (role-filtered) |
| `POST` | `/` | JWT (admin/manager) | Create program |
| `GET` | `/:id` | JWT | Get program details |
| `PATCH` | `/:id` | JWT (admin/manager) | Update program |
| `DELETE` | `/:id` | JWT (admin) | Delete program |
| `GET` | `/:id/members` | JWT | List program members |
| `POST` | `/:id/members` | JWT (admin/manager) | Add member |
| `DELETE` | `/:id/members/:userId` | JWT (admin/manager) | Remove member |

### Requests (`/api/v1/programs/:programId/requests`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | JWT | List requests (paginated, filtered, sorted) |
| `POST` | `/` | JWT | Create request |
| `GET` | `/:id` | JWT | Get request |
| `GET` | `/:id/detail` | JWT | Get request + comments + attachments + audit |
| `PATCH` | `/:id` | JWT | Update request fields |
| `PATCH` | `/:id/status` | JWT | Transition request status |
| `PATCH` | `/:id/assign` | JWT | Assign request to user |
| `DELETE` | `/:id` | JWT | Delete draft request |
| `GET` | `/export` | JWT | Export requests as CSV |

### Comments (`/api/v1/programs/:programId/requests/:requestId/comments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | JWT | List comments (paginated) |
| `POST` | `/` | JWT | Add comment |
| `DELETE` | `/:id` | JWT | Delete comment (author/admin/manager) |

### Attachments (`/api/v1/programs/:programId/requests/:requestId/attachments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | JWT | List attachments |
| `POST` | `/` | JWT | Upload file (Multer, 10MB max) |
| `GET` | `/:id/download` | JWT | Download file |
| `DELETE` | `/:id` | JWT | Delete attachment |

### Import (`/api/v1/programs/:programId/requests/import`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/upload` | JWT | Upload CSV file |
| `POST` | `/validate` | JWT | Validate column mapping |
| `POST` | `/execute` | JWT | Execute import |
| `GET` | `/history` | JWT | List past imports |

### Chains (`/api/v1/programs/:programId/chains`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | JWT | List chains |
| `POST` | `/` | JWT | Create chain |
| `GET` | `/:id` | JWT | Get chain with steps |
| `PATCH` | `/:id` | JWT | Update chain |

### Reports (`/api/v1/reports`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | JWT | List report jobs |
| `POST` | `/` | JWT | Request report generation |
| `GET` | `/:id` | JWT | Get report result |

### Notifications (`/api/v1/notifications`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | JWT | List notifications (paginated) |
| `GET` | `/unread-count` | JWT | Get unread count |
| `PATCH` | `/:id/read` | JWT | Mark one as read |
| `PATCH` | `/read-all` | JWT | Mark all as read |

### Audit Logs (`/api/v1/programs/:programId/audit`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | JWT | List audit entries (filtered) |

### Internal API (`/api/v1/internal`) — n8n only, blocked by Nginx

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | API Key | Connectivity check |
| `POST` | `/socket-emit` | API Key | Push socket event to program room |
| `POST` | `/notifications` | API Key | Create in-app notification |
| `GET` | `/pending-reminders` | API Key | Fetch requests needing reminders |
| `GET` | `/report-data` | API Key | Run report aggregation |
| `POST` | `/report-complete` | API Key | Store report results |

---

## 13. Authentication & Authorization

### JWT Token Strategy

- **Access Token**: 15 min TTL, stored in memory (frontend), sent as `Authorization: Bearer <token>`
- **Refresh Token**: 7 day TTL, stored as httpOnly cookie, used to rotate access tokens
- **Passport.js** JWT strategy extracts token from Authorization header

### Role Hierarchy

```
admin > manager > team_member > client
```

| Role | Capabilities |
|------|-------------|
| **admin** | Full access. Manage users, programs, all requests. |
| **manager** | Manage programs they're in. Approve/reject requests. |
| **team_member** | View assigned programs. Review requests. |
| **client** | Submit requests. View own requests only. |

### Middleware Stack

1. **`authenticate`**: Verifies JWT, attaches `req.user`
2. **`authorize(...roles)`**: Checks `req.user.role` against allowed roles
3. **`internalAuth`**: Validates `x-api-key` header (for n8n internal API)

---

## 14. Real-Time (Socket.IO)

### Server Side

- Initialized in `server.ts` after HTTP server starts
- JWT authenticated on connection handshake
- Users join rooms: `user:{userId}`, `program:{programId}`
- Events emitted via `emitToProgram(programId, eventName, payload)`
- Notifications pushed directly to user sockets

### Client Side

- Connects on login, disconnects on logout
- Reconnection: exponential backoff (1s–10s), max 10 attempts
- `useSocket` hook subscribes to events per component
- Token refreshed on each reconnect

### Event Catalog

| Event | Direction | Payload |
|-------|-----------|---------|
| `request:created` | Server → Client | Request data |
| `request:updated` | Server → Client | Request + changed fields |
| `request:status_changed` | Server → Client | Request + from/to status |
| `request:assigned` | Server → Client | Request + assignee info |
| `request:deleted` | Server → Client | Request ID |
| `comment:added` | Server → Client | Comment data |
| `comment:deleted` | Server → Client | Comment ID |
| `attachment:uploaded` | Server → Client | Attachment data |
| `attachment:deleted` | Server → Client | Attachment ID |
| `notification:created` | Server → User | Notification object |
| `report:completed` | Server → User | Report ID + status |

---

## 15. Key Design Patterns

### Outbox Pattern (Webhook Delivery)

Instead of calling n8n synchronously during request mutations, events are written to a MongoDB `webhookEvents` collection (the "outbox"). A background processor runs every 10 seconds, reads pending events, and delivers them to n8n. This ensures:

- Main request handlers are never blocked by n8n availability
- Events survive server restarts (persisted in DB)
- Failed deliveries retry with exponential backoff (30s × retryCount)
- Maximum 5 retries per event

### Fire-and-Forget Side Effects

Audit logging, webhook enqueueing, socket events, and notifications are all wrapped in `.then().catch(() => {})` blocks. They never block the main response to the user. If they fail, errors are logged but the primary operation succeeds.

### Cache-Aside with Redis

```
Read:  Check Redis → Cache hit? Return cached → Miss? Query MongoDB → Store in Redis → Return
Write: Perform MongoDB write → Invalidate relevant Redis keys
```

TTLs: 5 min for individual records, pattern-based invalidation for lists.

### Immutable Audit Trail

Every mutation (create, update, status change, delete, assignment, comment, attachment) generates an audit log entry with:
- `before` state (snapshot before change)
- `after` state (snapshot after change)
- `performedBy` (user who did it)
- `timestamp` (server clock)

Audit logs are append-only — no update or delete operations exist.

### Zod Validation

All API inputs are validated using Zod schemas before reaching service layer. Environment variables are also validated at boot via Zod, failing fast on missing/invalid config.

---

*Generated from codebase analysis on 2026-02-27.*
