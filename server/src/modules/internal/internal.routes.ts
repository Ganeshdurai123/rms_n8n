import { Router } from 'express';
import { internalAuth } from '../../middleware/internalAuth.js';
import {
  healthCheck,
  socketEmit,
  createNotificationHandler,
  getPendingReminders,
  getReportData,
  completeReportHandler,
  transitionRequestHandler,
  updateRequestHandler,
} from './internal.controller.js';

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

// POST /api/v1/internal/notifications -- n8n creates in-app notifications after email dispatch
internalRouter.post('/notifications', createNotificationHandler);

// GET /api/v1/internal/pending-reminders -- n8n checks for stale requests needing reminder emails
internalRouter.get('/pending-reminders', getPendingReminders);

// GET /api/v1/internal/report-data -- n8n fetches aggregation data for a report job
internalRouter.get('/report-data', getReportData);

// POST /api/v1/internal/report-complete -- n8n posts completed report results back
internalRouter.post('/report-complete', completeReportHandler);

// Request management for automation
internalRouter.patch('/requests/:requestId', updateRequestHandler);
internalRouter.post('/requests/:requestId/transition', transitionRequestHandler);

export { internalRouter };
