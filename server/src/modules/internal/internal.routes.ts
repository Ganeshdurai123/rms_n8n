import { Router } from 'express';
import { internalAuth } from '../../middleware/internalAuth.js';
import { healthCheck, socketEmit } from './internal.controller.js';

// ---------------------------------------------------------------------------
// Internal API Router
// ---------------------------------------------------------------------------

/**
 * Routes for internal service-to-service communication (n8n -> Express).
 *
 * All routes require shared-secret authentication via `x-api-key` header.
 * External access is blocked by nginx (see docker/nginx/default.conf).
 */
const internalRouter = Router();

// Apply shared-secret auth to all internal routes
internalRouter.use(internalAuth);

// GET /api/v1/internal/health -- connectivity test for n8n
internalRouter.get('/health', healthCheck);

// POST /api/v1/internal/socket-emit -- push typed events to program rooms
internalRouter.post('/socket-emit', socketEmit);

export { internalRouter };
