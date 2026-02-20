# Architecture Research

**Domain:** Request Management System with n8n automation integration
**Researched:** 2026-02-20
**Confidence:** HIGH (established patterns for Express/MongoDB/n8n, well-understood domain)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NGINX REVERSE PROXY (:80/:443)                     │
│   /api/* → server:5000    /socket.io/* → server:5000    /* → client:3000   │
└──────────┬──────────────────────┬──────────────────────────┬────────────────┘
           │                      │                          │
┌──────────▼──────────┐  ┌───────▼────────┐  ┌──────────────▼───────────────┐
│   EXPRESS SERVER     │  │  SOCKET.IO     │  │     REACT SPA (Vite)        │
│   (:5000)            │  │  (same proc)   │  │     (:3000 dev)             │
│                      │  │                │  │                             │
│  ┌────────────────┐  │  │  Rooms per     │  │  Auth → Programs → Sheets   │
│  │ Auth Middleware │  │  │  programId     │  │  → Requests → Books         │
│  │ (Passport+JWT) │  │  │                │  │                             │
│  ├────────────────┤  │  │  Internal emit │  │  Socket.IO client           │
│  │ RBAC Middleware │  │  │  endpoint for  │  │  for real-time              │
│  ├────────────────┤  │  │  n8n callbacks  │  │                             │
│  │ Route Modules  │  │  └────────────────┘  └─────────────────────────────┘
│  │ (10 modules)   │  │
│  ├────────────────┤  │         ┌──────────────────────────────────┐
│  │ Zod Validation │  │         │         n8n (self-hosted)        │
│  ├────────────────┤  │         │         (:5678)                  │
│  │ Service Layer  │──┼────────►│                                  │
│  ├────────────────┤  │ webhook │  ┌────────────┐ ┌────────────┐  │
│  │ Webhook Emitter│  │  POST   │  │ Email      │ │ Reminder   │  │
│  ├────────────────┤  │         │  │ Workflows  │ │ Workflows  │  │
│  │ AuditLog Layer │  │◄────────┤  ├────────────┤ ├────────────┤  │
│  └────────────────┘  │callback │  │ Report Gen │ │ Status     │  │
│                      │ or emit │  │ Workflows  │ │ Workflows  │  │
│  Mongoose ODM        │         │  └────────────┘ └────────────┘  │
│        │             │         │                                  │
└────────┼─────────────┘         │  PostgreSQL (n8n internal DB)    │
         │                       └──────────────────────────────────┘
    ┌────▼────┐  ┌──────────┐
    │ MongoDB │  │  Redis   │
    │  (:27017)│  │ (:6379)  │
    │         │  │ cache    │
    │ All app │  │ only     │
    │ data    │  │          │
    └─────────┘  └──────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **Nginx** | Reverse proxy, SSL termination, static file serving, route splitting | Client, Server, Socket.IO |
| **Express Server** | API endpoints, business logic, authentication, authorization, webhook emission | MongoDB, Redis, n8n (outbound webhooks), Socket.IO |
| **Socket.IO** | Real-time event delivery to connected clients, room management per programId | Express (same process), React client |
| **React SPA** | User interface, forms, data tables, real-time display | Express API (HTTP), Socket.IO (WebSocket) |
| **n8n** | All async processing: email, reminders, report generation, scheduled tasks | Express API (callbacks), MongoDB (direct writes for reports), Socket emit endpoint |
| **MongoDB** | Primary data store for all application data | Express (via Mongoose), n8n (direct for specific workflows) |
| **Redis** | Response caching, session blacklist, rate limiting counters | Express only |

## Recommended Project Structure

### Backend (server/)

```
server/
├── src/
│   ├── config/
│   │   ├── db.ts                # MongoDB connection
│   │   ├── redis.ts             # Redis client
│   │   ├── passport.ts          # Passport JWT strategy
│   │   ├── socket.ts            # Socket.IO setup and room management
│   │   └── env.ts               # Environment validation (Zod)
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.schema.ts       # Zod schemas
│   │   │   └── auth.model.ts        # Mongoose model (User)
│   │   ├── program/
│   │   │   ├── program.routes.ts
│   │   │   ├── program.controller.ts
│   │   │   ├── program.service.ts
│   │   │   ├── program.schema.ts
│   │   │   └── program.model.ts
│   │   ├── sheet/
│   │   ├── request/
│   │   ├── request-book/
│   │   ├── comment/
│   │   ├── file/
│   │   ├── notification/
│   │   ├── report/
│   │   └── audit-log/
│   ├── middleware/
│   │   ├── authenticate.ts      # JWT verification via Passport
│   │   ├── authorize.ts         # RBAC role + program-level permission check
│   │   ├── validate.ts          # Generic Zod validation middleware
│   │   ├── pagination.ts        # Parse page/limit, attach to req
│   │   ├── rateLimiter.ts       # Redis-backed rate limiting
│   │   └── errorHandler.ts      # Global error handler
│   ├── shared/
│   │   ├── webhook.emitter.ts   # Fire-and-forget POST to n8n
│   │   ├── audit.logger.ts      # AuditLog creation helper
│   │   ├── cache.ts             # Redis cache helpers (get/set/invalidate)
│   │   ├── errors.ts            # Custom error classes (AppError, etc.)
│   │   └── types.ts             # Shared TypeScript types
│   ├── internal/
│   │   └── socket-emit.routes.ts  # POST /api/v1/internal/socket-emit
│   ├── app.ts                   # Express app setup
│   └── server.ts                # HTTP server + Socket.IO attach + listen
├── tests/
├── package.json
└── tsconfig.json
```

### Frontend (client/)

```
client/
├── src/
│   ├── api/                   # API client (axios instances, typed endpoints)
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── layout/            # Shell, sidebar, header
│   │   └── shared/            # Reusable domain components
│   ├── features/
│   │   ├── auth/              # Login, register, auth context
│   │   ├── programs/          # Program CRUD, config
│   │   ├── sheets/            # Sheet view, inline editing
│   │   ├── requests/          # Request forms, lifecycle
│   │   ├── request-books/     # Import wizard
│   │   ├── notifications/     # Notification bell, list
│   │   └── reports/           # Report views
│   ├── hooks/                 # useSocket, useAuth, usePagination
│   ├── lib/                   # Utilities, socket client setup
│   ├── stores/                # Zustand or context-based state
│   └── routes/                # React Router route definitions
├── package.json
└── vite.config.ts
```

### Structure Rationale

- **modules/:** Feature-based module organization keeps each domain's routes, controllers, services, models, and schemas co-located. With 10 modules, this prevents a sprawling flat structure. Each module is self-contained with clear boundaries.
- **middleware/:** Cross-cutting concerns (auth, RBAC, validation, pagination) shared across all modules. Kept separate because they compose onto any route.
- **shared/:** Utilities that multiple modules depend on (webhook emitter, audit logger, cache). Not module-specific but not middleware either.
- **internal/:** Endpoints not exposed to external clients. The socket-emit route is called only by n8n (validated by shared secret or IP allowlist).
- **features/:** Frontend mirrors the backend module structure, making it easy to map UI to API.

## Architectural Patterns

### Pattern 1: Modular Monolith with Webhook Sidecar

**What:** Single Express process handles all HTTP and WebSocket traffic. Async processing is delegated to n8n as an external sidecar via fire-and-forget webhooks. The backend stays synchronous and simple.

**When to use:** Always for this project. This is the core architecture.

**Trade-offs:**
- PRO: Backend stays simple, no job queue infrastructure, n8n provides visual workflow editor
- PRO: n8n failures are isolated from the main app
- CON: n8n is an operational dependency for emails, reminders, reports
- CON: No retry guarantee from the Express side (n8n must handle its own retries)

**Example:**
```typescript
// shared/webhook.emitter.ts
import axios from 'axios';

const N8N_BASE_URL = process.env.N8N_WEBHOOK_BASE_URL; // e.g. http://n8n:5678/webhook

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  meta: { triggeredBy: string; timestamp: string; };
}

export async function emitWebhook(event: string, data: Record<string, unknown>, userId: string): Promise<void> {
  const payload: WebhookPayload = {
    event,
    data,
    meta: { triggeredBy: userId, timestamp: new Date().toISOString() },
  };

  // Fire-and-forget: do not await, catch errors silently
  axios.post(`${N8N_BASE_URL}/${event}`, payload, {
    timeout: 5000,
    headers: { 'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET },
  }).catch((err) => {
    console.error(`[webhook] Failed to emit ${event}:`, err.message);
    // Optionally: write to a dead-letter collection in MongoDB for manual retry
  });
}
```

### Pattern 2: Embedded Document Dynamic Fields (NOT EAV)

**What:** Store dynamic field definitions on the Program document and dynamic field values directly embedded in each Request document. Avoid Entity-Attribute-Value (EAV) tables entirely.

**When to use:** For this project's dynamic fields requirement (text, number, date, dropdown, checkbox, file upload).

**Trade-offs:**
- PRO: Single query retrieves a request with all its field values (no joins)
- PRO: MongoDB's flexible schema naturally supports varying field shapes per program
- PRO: Indexing on specific dynamic fields possible via `customFields.fieldSlug` paths
- CON: Querying across programs on dynamic fields is harder (different schemas)
- CON: Schema migration when field definitions change requires a strategy

**Example:**
```typescript
// Program model — defines what fields exist
const FieldDefinitionSchema = new Schema({
  slug: { type: String, required: true },          // machine name: "budget_amount"
  label: { type: String, required: true },         // display: "Budget Amount"
  type: { type: String, enum: ['text', 'number', 'date', 'dropdown', 'checkbox', 'file'], required: true },
  required: { type: Boolean, default: false },
  options: [String],                                // for dropdown type
  order: { type: Number, required: true },
});

const ProgramSchema = new Schema({
  name: String,
  fieldDefinitions: [FieldDefinitionSchema],        // array of field defs
  // ... other program config
});

// Request model — stores actual field values
const RequestSchema = new Schema({
  programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true, index: true },
  status: { type: String, enum: ['draft','submitted','in_review','approved','rejected','completed'] },
  customFields: { type: Map, of: Schema.Types.Mixed }, // { "budget_amount": 50000, "department": "Engineering" }
  // ... other request fields
});
```

### Pattern 3: RBAC Middleware with Program-Scoped Permissions

**What:** Two-layer authorization: global role check (admin/manager/team_member/client) then program-level permission check. The middleware is composable: `authorize('manager', 'admin')` for role-only checks or `authorizeProgram('canEditRequests')` for program-scoped checks.

**When to use:** Every protected route. The two layers handle different concerns.

**Trade-offs:**
- PRO: Clean separation of global roles and program-level permissions
- PRO: Middleware is declarative and composable on routes
- CON: Requires a ProgramMembership collection or embedded membership on Program
- CON: Every program-scoped request needs a membership lookup (cacheable in Redis)

**Example:**
```typescript
// middleware/authorize.ts
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError('Insufficient permissions', 403);
    }
    next();
  };
}

// middleware/authorizeProgram.ts — checks program membership
export function authorizeProgram(permission: ProgramPermission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const programId = req.params.programId || req.body.programId;
    if (req.user.role === 'admin') return next(); // admin bypasses

    const membership = await ProgramMember.findOne({
      userId: req.user._id,
      programId,
    }).lean();

    if (!membership || !membership.permissions.includes(permission)) {
      throw new AppError('No access to this program', 403);
    }

    req.programMembership = membership; // attach for downstream use
    next();
  };
}

// Usage in routes
router.put(
  '/programs/:programId/requests/:requestId',
  authenticate,
  authorize('admin', 'manager', 'team_member'),
  authorizeProgram('canEditRequests'),
  validate(updateRequestSchema),
  requestController.update
);
```

### Pattern 4: Event Catalog for n8n Webhooks

**What:** A centralized catalog of all webhook events the backend can emit, with typed payloads. This serves as the contract between Express and n8n. Each event maps to one n8n webhook URL path.

**When to use:** Every mutation that should trigger async processing.

**Trade-offs:**
- PRO: Single source of truth for the Express-to-n8n contract
- PRO: Type safety on payloads prevents breaking n8n workflows
- PRO: Easy to audit what events exist and what data they carry
- CON: Must keep in sync with n8n workflow webhook triggers (manual process)

**Example:**
```typescript
// shared/webhook.events.ts
export const WebhookEvents = {
  // Request lifecycle
  'request.created': { data: ['requestId', 'programId', 'createdBy'] },
  'request.status_changed': { data: ['requestId', 'programId', 'oldStatus', 'newStatus', 'changedBy'] },
  'request.assigned': { data: ['requestId', 'programId', 'assigneeId', 'assignedBy'] },
  'request.commented': { data: ['requestId', 'programId', 'commentId', 'authorId'] },
  'request.file_uploaded': { data: ['requestId', 'programId', 'fileId', 'uploadedBy'] },

  // Program lifecycle
  'program.created': { data: ['programId', 'createdBy'] },
  'program.member_added': { data: ['programId', 'userId', 'role'] },

  // Request books
  'request_book.import_completed': { data: ['bookId', 'programId', 'requestCount', 'importedBy'] },

  // Reports (triggers async generation in n8n)
  'report.generation_requested': { data: ['reportType', 'programId', 'requestedBy', 'parameters'] },
} as const;

export type WebhookEvent = keyof typeof WebhookEvents;
```

### Pattern 5: Internal API Endpoint for n8n Callbacks

**What:** A dedicated route namespace (`/api/v1/internal/`) that is not exposed to frontend clients. Protected by a shared secret header or IP allowlist (n8n Docker network). n8n uses these endpoints to push data back into the system.

**When to use:** When n8n needs to write results back (notification records, report results, status updates) or push Socket.IO events.

**Trade-offs:**
- PRO: n8n can trigger real-time updates without direct MongoDB access for most operations
- PRO: Business logic (validation, audit logging) still runs through Express
- CON: Adds latency compared to n8n writing directly to MongoDB
- RECOMMENDATION: Use internal API for operations needing validation/audit; allow n8n direct MongoDB writes only for bulk report data

**Example:**
```typescript
// internal/socket-emit.routes.ts
router.post('/api/v1/internal/socket-emit',
  validateInternalSecret,  // check x-internal-secret header
  validate(socketEmitSchema),
  (req, res) => {
    const { room, event, data } = req.body;
    io.to(room).emit(event, data);
    res.json({ success: true });
  }
);

// internal/notification.routes.ts
router.post('/api/v1/internal/notifications',
  validateInternalSecret,
  validate(createNotificationSchema),
  notificationController.createFromN8n  // creates record + emits socket event
);
```

## Data Flow

### Primary Request Flow (User creates a request)

```
React Client
    │
    ▼ POST /api/v1/programs/:programId/requests
Express Server
    │
    ├─► authenticate (JWT verify via Passport)
    ├─► authorize (role check)
    ├─► authorizeProgram (program membership check)
    ├─► validate (Zod schema validation against program's field definitions)
    │
    ▼ requestService.create()
    │
    ├─► MongoDB: Insert Request document
    ├─► MongoDB: Insert AuditLog entry
    ├─► Redis: Invalidate cached request lists for this program
    ├─► Socket.IO: Emit 'request:created' to room `program:${programId}`
    ├─► Webhook: Fire-and-forget POST to n8n `/webhook/request.created`
    │
    ▼ Return 201 { request } to client
```

### n8n Callback Flow (n8n sends email, then notifies)

```
n8n receives webhook POST (request.created)
    │
    ├─► n8n workflow: Look up program managers (via Express API or MongoDB query)
    ├─► n8n workflow: Send email notification to managers
    ├─► n8n workflow: POST /api/v1/internal/notifications
    │       │
    │       ▼ Express: Create Notification in MongoDB + AuditLog
    │       ▼ Express: Emit socket event to user's room
    │
    ▼ Workflow complete
```

### Real-Time Update Flow (Socket.IO)

```
Client connects
    │
    ▼ Socket.IO handshake (JWT in auth query)
Server validates JWT
    │
    ▼ Joins rooms based on user's program memberships
      room: "program:${programId}" for each membership
      room: "user:${userId}" for personal notifications

Events flow:
  Express mutation ──► io.to('program:X').emit('request:updated', data)
  n8n callback ──────► POST /internal/socket-emit { room, event, data }
                           ──► io.to(room).emit(event, data)

Client receives:
  socket.on('request:updated', (data) => { /* update UI */ })
  socket.on('notification:new', (data) => { /* show toast, update bell */ })
```

### Request Book Import Flow

```
React Client
    │
    ▼ Upload CSV/Excel file
    ▼ POST /api/v1/programs/:programId/request-books (file + mapping config)
Express Server
    │
    ├─► Validate file type and size
    ├─► Store file (local/object storage)
    ├─► Create RequestBook record (status: 'pending')
    ├─► Parse file headers, return column names for mapping UI
    │
    ▼ Client configures field mapping (CSV columns → program field slugs)
    ▼ POST /api/v1/programs/:programId/request-books/:bookId/import
    │
    ├─► Validate mapping against program field definitions
    ├─► Parse rows, validate each row against Zod schema
    ├─► Batch insert valid Request documents
    ├─► Create AuditLog entries
    ├─► Update RequestBook status to 'completed' with stats
    ├─► Webhook: POST to n8n `/webhook/request_book.import_completed`
    │
    ▼ Return import results (success count, error rows)
```

### Key Data Flows

1. **Authentication flow:** Client sends credentials -> Express returns JWT pair (access 15min + refresh 7d) -> Client stores tokens -> Every API call includes Authorization header -> Passport middleware validates -> On expiry, client calls /auth/refresh with refresh token.

2. **Dynamic field validation flow:** Program defines fieldDefinitions -> When request is created/updated, service fetches program's fieldDefinitions -> Builds Zod schema dynamically from definitions -> Validates request's customFields against dynamic schema -> Rejects if required fields missing or types mismatch.

3. **Audit trail flow:** Every mutation (create, update, delete, status change) -> Service calls `auditLogger.log({ action, entity, entityId, userId, before, after })` -> AuditLog document inserted in MongoDB -> Queryable for request history timeline display.

4. **Cache invalidation flow:** Mutations invalidate relevant Redis keys by pattern (e.g., `requests:program:${programId}:*`) -> Next read query misses cache, fetches from MongoDB, repopulates cache -> TTLs provide fallback invalidation (5 min for lists, 15 min for configs).

## MongoDB Schema Design Recommendations

### Core Collections

| Collection | Purpose | Key Indexes |
|-----------|---------|-------------|
| **users** | All user accounts (internal + client) | `{ email: 1 }` unique |
| **programs** | Program config, field definitions, boundary rules | `{ slug: 1 }` unique |
| **program_members** | User-program membership with permissions | `{ programId: 1, userId: 1 }` unique compound |
| **requests** | Individual requests with dynamic field values | `{ programId: 1, status: 1 }`, `{ programId: 1, createdAt: -1 }` |
| **comments** | Request comments | `{ requestId: 1, createdAt: 1 }` |
| **files** | File metadata (path, size, type, uploader) | `{ requestId: 1 }` |
| **notifications** | In-app notifications per user | `{ userId: 1, read: 1, createdAt: -1 }` |
| **audit_logs** | Immutable audit trail | `{ entityType: 1, entityId: 1 }`, `{ userId: 1, createdAt: -1 }` |
| **request_books** | Import job records with mapping config and results | `{ programId: 1 }` |
| **reports** | Generated report metadata and results | `{ programId: 1, type: 1 }` |

### Why Embedded Documents over EAV

For this system's dynamic fields, **embedded documents with a Map type** is the correct choice:

| Approach | Query Performance | Schema Flexibility | Complexity | Verdict |
|----------|------------------|--------------------|------------|---------|
| **EAV (separate collection)** | Poor (N+1 queries or complex aggregation) | Maximum | High | Reject: overkill for 6 field types |
| **Embedded Map (recommended)** | Excellent (single document read) | High (MongoDB is schema-flexible) | Low | Use this: best fit for MongoDB |
| **Mixed/schemaless** | Same as embedded | Maximum but unsafe | Medium | Reject: loses Mongoose validation |

The embedded Map approach stores `customFields` as `{ slug: value }` directly on the Request document. Field definitions on the Program provide the schema for validation. This is idiomatic MongoDB and avoids the relational anti-pattern of EAV in a document database.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 users (v1 target) | Single Docker Compose stack. MongoDB without replica set. Redis single instance. n8n single worker. This is sufficient. |
| 500-5k users | Add MongoDB replica set for read scaling and HA. Add Redis Sentinel. n8n may need queue mode with multiple workers. Add request-level indexing on frequently-filtered dynamic fields. |
| 5k+ users | Consider splitting n8n to dedicated host. Add MongoDB sharding on programId if single programs grow very large. Consider CDN for file uploads. Socket.IO may need Redis adapter for horizontal scaling of Express. |

### Scaling Priorities

1. **First bottleneck: MongoDB query performance on request lists.** Large programs with thousands of requests and dynamic field filtering will hit this first. Mitigation: compound indexes on `{ programId, status, createdAt }`, pagination enforced from day one, Redis caching of list queries.

2. **Second bottleneck: Socket.IO connections.** Each connected client holds a WebSocket. At ~2k concurrent connections on a single Express process, memory becomes a concern. Mitigation: Socket.IO Redis adapter allows multiple Express processes to share rooms. Not needed for v1.

3. **Third bottleneck: n8n throughput.** If many mutations happen simultaneously (bulk import of 1000 requests), n8n receives 1000 webhook calls. Mitigation: For bulk operations, emit a single `request_book.import_completed` event instead of per-request events. n8n handles the fan-out internally.

## Anti-Patterns

### Anti-Pattern 1: Awaiting Webhook Calls

**What people do:** `await axios.post(n8nWebhookUrl, payload)` in the request handler, making the API response wait for n8n.
**Why it's wrong:** n8n latency (100-500ms+) adds directly to API response time. If n8n is down, API calls fail.
**Do this instead:** Fire-and-forget with `.catch()` error logging. Never `await` the webhook call in the request path. The user's HTTP response should return immediately after the MongoDB write.

### Anti-Pattern 2: EAV Tables in MongoDB

**What people do:** Create a separate `field_values` collection with `{ requestId, fieldSlug, value }` documents, mimicking relational EAV patterns.
**Why it's wrong:** MongoDB is a document database. EAV forces you into aggregation pipelines with `$lookup` to reconstruct a request, killing the primary advantage of document storage.
**Do this instead:** Embed dynamic field values as a Map directly on the Request document. Use the Program's field definitions for runtime validation.

### Anti-Pattern 3: Global Socket.IO Broadcasts

**What people do:** `io.emit('request:updated', data)` broadcasting to all connected clients.
**Why it's wrong:** Every client receives events for every program, causing unnecessary network traffic, potential data leaks, and client-side filtering overhead.
**Do this instead:** Use rooms. `io.to('program:${programId}').emit(...)`. Join users to rooms based on their program memberships during the Socket.IO connection handshake.

### Anti-Pattern 4: Fat Controllers

**What people do:** Put business logic (validation, authorization checks, database queries, webhook emission, audit logging) directly in route handler functions.
**Why it's wrong:** Untestable, unreusable, unmaintainable. The same logic needs to run when n8n calls back via internal API.
**Do this instead:** Controllers are thin (parse request, call service, send response). Services contain business logic. Services are callable from controllers AND from internal API handlers.

### Anti-Pattern 5: n8n Direct MongoDB Writes for Everything

**What people do:** Have n8n write directly to MongoDB for all callback operations, bypassing Express entirely.
**Why it's wrong:** Skips validation, audit logging, cache invalidation, and socket event emission. Creates two sources of truth for write logic.
**Do this instead:** n8n should call back into Express internal API endpoints for most operations. Only allow direct MongoDB writes for bulk data that doesn't need per-record validation (e.g., report result storage).

### Anti-Pattern 6: Storing Files in MongoDB (GridFS)

**What people do:** Store uploaded files as binary in MongoDB using GridFS.
**Why it's wrong:** Bloats the database, makes backups huge, no CDN integration, poor streaming performance at scale.
**Do this instead:** Store files on the local filesystem (Docker volume) for v1, with metadata (path, size, mimetype, uploader) in MongoDB. Design the File model so you can swap to S3-compatible object storage later by changing only the storage adapter.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **n8n (outbound)** | Fire-and-forget HTTP POST to webhook URLs | Use shared secret in header for authentication. Timeout 5s. Log failures but never block. |
| **n8n (inbound)** | n8n calls POST /api/v1/internal/* endpoints | Validate `x-internal-secret` header. These routes skip JWT auth but have their own secret validation. |
| **n8n (direct MongoDB)** | n8n connects to MongoDB via connection string | Use ONLY for bulk report result writes. Everything else goes through internal API. |
| **SMTP (via n8n)** | n8n's built-in email nodes handle all email | Express never sends email directly. n8n can use any SMTP provider. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Controller <-> Service | Direct function call | Controllers call services. Services never call controllers. |
| Service <-> Service | Direct function call (import) | Allowed but keep minimal. If two services talk often, they may belong in the same module. |
| Module <-> Webhook | Via shared webhook emitter | Services call `emitWebhook()` at end of mutations. Emitter is a shared utility, not module-specific. |
| Module <-> AuditLog | Via shared audit logger | Services call `auditLogger.log()`. Audit module provides the utility but doesn't import other modules. |
| Module <-> Socket.IO | Via `io.to(room).emit()` | Services access the Socket.IO instance via dependency injection or a shared module. |
| Express <-> n8n | HTTP only (webhooks + internal API) | No shared database access patterns except the explicit MongoDB direct-write exception for reports. |

## API Route Organization (10 Modules)

```
/api/v1/
├── /auth
│   ├── POST   /register
│   ├── POST   /login
│   ├── POST   /refresh
│   ├── POST   /logout
│   └── GET    /me
├── /users
│   ├── GET    /                    (admin)
│   ├── GET    /:userId
│   ├── PATCH  /:userId             (admin)
│   └── DELETE /:userId             (admin)
├── /programs
│   ├── GET    /
│   ├── POST   /
│   ├── GET    /:programId
│   ├── PATCH  /:programId
│   ├── DELETE /:programId
│   ├── GET    /:programId/members
│   ├── POST   /:programId/members
│   └── DELETE /:programId/members/:memberId
├── /programs/:programId/sheets
│   ├── GET    /
│   ├── POST   /
│   ├── GET    /:sheetId
│   ├── PATCH  /:sheetId
│   └── DELETE /:sheetId
├── /programs/:programId/requests
│   ├── GET    /
│   ├── POST   /
│   ├── GET    /:requestId
│   ├── PATCH  /:requestId
│   ├── DELETE /:requestId
│   └── PATCH  /:requestId/status
├── /requests/:requestId/comments
│   ├── GET    /
│   ├── POST   /
│   ├── PATCH  /:commentId
│   └── DELETE /:commentId
├── /requests/:requestId/files
│   ├── GET    /
│   ├── POST   /                   (multipart upload)
│   ├── GET    /:fileId/download
│   └── DELETE /:fileId
├── /programs/:programId/request-books
│   ├── GET    /
│   ├── POST   /                   (upload file)
│   ├── GET    /:bookId
│   ├── POST   /:bookId/import     (trigger import)
│   └── GET    /:bookId/errors     (view import errors)
├── /notifications
│   ├── GET    /                   (current user's notifications)
│   ├── PATCH  /:notificationId/read
│   └── POST   /mark-all-read
├── /audit-logs
│   └── GET    /                   (admin, with entity filters)
├── /reports                        (v2)
│   ├── POST   /generate
│   └── GET    /:reportId
│
└── /internal                       (n8n only, not exposed to frontend)
    ├── POST   /socket-emit
    ├── POST   /notifications
    └── POST   /reports/:reportId/results
```

## Suggested Build Order (Dependencies)

Build order is driven by data dependencies -- each phase builds on the previous.

```
Phase 1: Foundation
  ├── Express skeleton + TypeScript + env config
  ├── MongoDB connection + Mongoose setup
  ├── Redis connection
  ├── Error handling middleware
  ├── User model + Auth module (register, login, JWT, refresh)
  └── Passport.js JWT strategy
       │
Phase 2: Core Domain
  ├── RBAC middleware (authorize by role)
  ├── Program model + CRUD
  ├── Program membership + program-level authorization
  ├── Dynamic field definitions on Program
  ├── Pagination middleware
  ├── AuditLog model + shared audit logger
  └── Zod validation middleware
       │
Phase 3: Request Lifecycle
  ├── Request model (with embedded customFields Map)
  ├── Dynamic field validation (build Zod schema from program field defs)
  ├── Request CRUD + status transitions
  ├── Comment model + CRUD
  ├── File upload (local storage) + File model + CRUD
  └── Request history (from AuditLog)
       │
Phase 4: Real-Time + Webhooks
  ├── Socket.IO setup (auth, room join logic)
  ├── Socket events on mutations (request, comment, status)
  ├── Webhook emitter (fire-and-forget)
  ├── Event catalog definition
  ├── Internal socket-emit endpoint
  └── Internal notification endpoint
       │
Phase 5: n8n Integration
  ├── Docker Compose with n8n service
  ├── n8n workflows: email on request.created, request.status_changed
  ├── n8n workflows: assignment notifications
  ├── n8n scheduled workflows: reminder emails
  ├── Notification model + in-app notification CRUD
  └── n8n callback flow testing (end-to-end)
       │
Phase 6: Advanced Features
  ├── Sheet model + CRUD (tabular view of requests)
  ├── Request Book import (upload, parse, map, validate, batch insert)
  ├── CSV export of sheets
  ├── Client portal (restricted views via RBAC, same SPA)
  └── Redis caching layer on list endpoints
       │
Phase 7: Reports + Polish (v2)
  ├── Report generation via n8n (async)
  ├── Due dates + calendar view
  ├── Dashboard summary views
  └── Performance optimization
```

**Build order rationale:**
- Auth and Users come first because every other module depends on authenticated identity.
- Programs come before Requests because requests belong to programs and inherit field definitions.
- Request lifecycle before Socket.IO because you need mutations happening before you can emit events about them.
- Socket.IO before n8n integration because the internal socket-emit endpoint is needed for n8n callbacks.
- n8n integration as its own phase because it requires all the internal endpoints to exist first.
- Advanced features (sheets, request books, CSV) build on top of the complete request system.
- Reports are v2 because they require everything else to be working and generating data.

## Sources

- MongoDB documentation on embedded documents and Map types (official docs, HIGH confidence)
- Express.js middleware composition patterns (established community practice, HIGH confidence)
- Socket.IO rooms documentation (official docs, HIGH confidence)
- n8n webhook trigger documentation (official docs, HIGH confidence)
- Mongoose discriminators and schema design patterns (official docs, HIGH confidence)
- RBAC middleware patterns for Express (well-established community pattern, HIGH confidence)
- Note: WebSearch was unavailable during this research. All recommendations are based on verified patterns from official documentation and established architectural practices for Express/MongoDB/Socket.IO/n8n systems.

---
*Architecture research for: Request Management System with n8n automation*
*Researched: 2026-02-20*
