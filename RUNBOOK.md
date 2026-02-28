# RMS n8n — Application Runbook

A complete guide for setting up, running, and troubleshooting the Request Management System (RMS) with n8n automation.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Environment Setup](#environment-setup)
4. [Running the Application](#running-the-application)
5. [Useful Commands](#useful-commands)
6. [Accessing the Application](#accessing-the-application)
7. [New Features Developed](#new-features-developed)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, make sure you have the following installed:

| Tool | Version | Download |
|------|---------|---------|
| Docker Desktop | Latest | https://www.docker.com/products/docker-desktop |
| Node.js | 20.x | https://nodejs.org |
| Git | Any | https://git-scm.com |

> **IMPORTANT:** On **Windows**, make sure Docker Desktop is running in **Linux container mode** (not Windows containers). Check by right-clicking the Docker tray icon.

---

## Project Structure

```
rms_n8n/
├── client/                 # React + Vite frontend
├── server/                 # Express + TypeScript backend
├── docker/
│   ├── client/Dockerfile   # Vite dev server container
│   ├── server/Dockerfile   # tsx watch server container
│   └── nginx/              # Nginx reverse proxy config
├── docker-compose.yml      # All services definition
└── .env                    # Environment variables (create this)
```

---

## Environment Setup

### 1. Create the `.env` file

Create a `.env` file in the **project root** (`rms_n8n/`) with the following variables:

```env
# MongoDB
MONGODB_URI=mongodb://mongo:27017/rms

# JWT Auth
JWT_SECRET=your-very-long-random-secret-here-min-32-chars
JWT_EXPIRY=7d

# Internal API (for n8n to call the backend)
INTERNAL_API_KEY=your-internal-api-key-here

# n8n credentials
N8N_DB_PASSWORD=your-n8n-db-password
N8N_USER=admin
N8N_PASSWORD=your-n8n-password

# Redis
REDIS_URL=redis://redis:6379

# App
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost
```

> **Tip:** `INTERNAL_API_KEY` is used by n8n to authenticate requests to the internal API. Choose a strong random string (e.g. 32+ characters).

---

## Running the Application

### Start all services

```powershell
cd "D:\New folder\rms_n8n"
docker-compose up -d
```

This starts 7 containers:
- `rms_mongo` — MongoDB database
- `rms_redis` — Redis cache
- `rms_server` — Express API backend
- `rms_client` — Vite React frontend (dev server)
- `rms_nginx` — Nginx reverse proxy (port 80)
- `rms_n8n_db` — PostgreSQL for n8n
- `rms_n8n` — n8n automation engine

### Stop all services

```powershell
docker-compose down
```

### Rebuild and restart (after code changes that require a rebuild)

```powershell
docker-compose down
docker-compose up -d --build
```

### Restart a single container (e.g. after backend code changes)

```powershell
docker restart rms_server
docker restart rms_client
```

---

## Useful Commands

### View live logs

```powershell
# All services
docker-compose logs -f

# Just the backend server
docker logs -f rms_server

# Just the frontend client
docker logs -f rms_client
```

### Check container health

```powershell
docker ps -a --format "table {{.Names}}`t{{.Status}}"
```

### Run MongoDB queries

```powershell
# Open mongo shell
docker exec -it rms_mongo mongosh

# Inside mongosh:
use rms
db.programs.find().toArray()
db.requests.find({}, { title: 1, status: 1, dueDate: 1 }).toArray()
```

### Enable due dates for a program (one-time database fix)

```powershell
docker exec rms_mongo mongosh --eval "db.getSiblingDB('rms').programs.updateOne({ _id: ObjectId('YOUR_PROGRAM_ID') }, { `$set`: { 'dueDateConfig.enabled': true, 'dueDateConfig.defaultOffsetDays': 5 } })"
```

### Backdate all requests for testing n8n overdue reminders

```powershell
docker exec rms_mongo mongosh --eval "db.getSiblingDB('rms').requests.updateMany({ programId: ObjectId('YOUR_PROGRAM_ID') }, { `$set`: { dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } })"
```

### TypeScript build check (frontend)

```powershell
cd "D:\New folder\rms_n8n\client"
npm run build
```

### TypeScript build check (backend)

```powershell
cd "D:\New folder\rms_n8n\server"
npm run build
```

---

## Accessing the Application

| Service | URL | Notes |
|---------|-----|-------|
| **Web App** | http://localhost | Main entry point via Nginx |
| **n8n Dashboard** | http://localhost:5678 | Workflow automation UI |
| **Backend API** | http://localhost:5000/api/v1 | Direct API access |
| **MongoDB** | localhost:27017 | Use MongoDB Compass or mongosh |

### Default Admin Login

| Field | Value |
|-------|-------|
| Email | `admin@rms.local` |
| Password | Set during first run via seed script |

---

## New Features Developed

### 1. Request Status Transitions
**Where:** Request Detail Page + Sheet List View

- Each request now has valid status transitions based on its current state and the user's role.
- A **Status Controls** panel appears at the top of every Request Detail Page with action buttons.
- Status transitions are also available via the row actions dropdown in the Sheet list view.
- **State machine:**
  - `draft` → `submitted`
  - `submitted` → `in_review` or `rejected`
  - `in_review` → `approved` or `rejected`
  - `approved` → `completed`
  - `rejected` → `submitted` (resubmit)
- **Role rules:**
  - Clients/creators can submit their own drafts.
  - **Admins and Managers can submit any draft** (403 bug was fixed).
  - Managers and Admins can move requests into review, approve, or reject.

---

### 2. Inline Status Editing in Sheet View
**Where:** Sheet View — inline edit mode (pencil icon on a row)

- When editing a row inline, the status field is now a **dropdown selector** instead of a static badge.
- Admins and Managers can change the status of any request directly from the table without opening the full detail page.

---

### 3. Manual Due Date Assignment During Assignment
**Where:** Request Detail Page — "Assign Request" dialog

- When an Admin or Manager clicks the **assign icon** (👤+) on a request, the assignment dialog now includes an optional **"Due Date"** calendar picker.
- Setting a date here overrides the program's automatic due date for that specific request.
- This date is immediately visible in n8n reminder workflows.

---

### 4. Due Date Settings (Per Program)
**Where A:** Programs List → "New Program" dialog  
**Where B:** Program Sheet View → **"Due Dates"** button in the header

#### When creating a new program:
- A **"Enable Due Dates"** checkbox section appears in the Create Program dialog.
- When enabled, a number input lets you set the **default days until due** (e.g. 7 = requests are due 7 days after creation).
- This is saved as part of the program's `dueDateConfig`.

#### For existing programs (Sheet View):
- A **"Due Dates"** button appears in the Sheet View header (only for Admins and Managers).
- It opens a dialog to toggle due dates on/off and update the default offset for that program.
- The button turns blue when due dates are currently **enabled** for that program.
- After saving, any **new requests** created will automatically receive a due date.

> **Note:** Changing these settings does not retroactively update existing requests. Use the MongoDB command above to backdate existing requests for testing.

---

### 5. n8n Internal API Authentication
**Where:** `docker-compose.yml` and `server/src/modules/internal/`

- n8n now passes the `INTERNAL_API_KEY` as a Bearer token to authenticate requests to the backend's internal endpoints.
- Environment variable `N8N_BLOCK_ENV_ACCESS_FOR_NODES: "false"` was added so n8n workflows can read environment variables directly.

---

### 6. n8n Reminder Endpoints
**Where:** `PATCH /api/v1/internal/requests/:requestId` and `GET /api/v1/internal/requests/reminders`

- The `/reminders` endpoint returns requests that are either **overdue** or **upcoming** (due within the next N days).
- Each result includes: requestId, title, programId, status, dueDate, daysOverdue, assignedTo, and createdBy.
- This powers the n8n Scheduled Reminder workflow which sends email/Slack notifications.

---

## Troubleshooting

### Containers not starting or crashing

```powershell
# Check logs for errors
docker logs rms_server
docker logs rms_client
```

### Frontend changes not reflecting

The client container uses hot-reloading (Vite HMR), but Windows Docker volume mounts sometimes have delay. Try:
```powershell
docker restart rms_client
```
Then do a **hard refresh** in browser: `Ctrl + Shift + R`

### Backend changes not reflecting

The server uses `tsx watch` for hot reload. If changes still aren't visible:
```powershell
docker restart rms_server
```

### API returns 401 from n8n

Check that the `INTERNAL_API_KEY` in your `.env` matches what's configured in your n8n HTTP Request node's `Authorization: Bearer <key>` header.

Also verify the n8n environment variable access is enabled:
```yaml
# In docker-compose.yml under n8n service:
N8N_BLOCK_ENV_ACCESS_FOR_NODES: "false"
```

### n8n reminders return empty `[]`

This means no requests have a `dueDate` set. Causes:
1. The program has `dueDateConfig.enabled = false` — use the "Due Dates" button in Sheet View to enable it.
2. Requests were created before due dates were enabled — use the MongoDB backdate command above.

### 403 Forbidden on status transitions

- Ensure you are logged in as **Admin** or **Manager**.
- For submitting a Draft: Admins and Managers can now do this (fixed bug).
- Check that the state machine allows the transition you're attempting.
