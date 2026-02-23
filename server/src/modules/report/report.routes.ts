import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { paginate } from '../../middleware/pagination.js';
import {
  createReportSchema,
  listReportsSchema,
  reportIdParamSchema,
} from './report.schema.js';
import { generateReport, listReports, getReport } from './report.controller.js';

// ---------------------------------------------------------------------------
// Report Router
// ---------------------------------------------------------------------------

/**
 * Routes for report generation, listing, and retrieval.
 * All routes require JWT authentication.
 */
const reportRouter = Router();

// All report routes require authentication
reportRouter.use(authenticate);

// POST /reports -- generate a new report (returns 202 Accepted)
reportRouter.post(
  '/',
  validate(createReportSchema, 'body'),
  generateReport,
);

// GET /reports -- list reports (paginated, filterable by type/status)
reportRouter.get(
  '/',
  validate(listReportsSchema, 'query'),
  paginate(),
  listReports,
);

// GET /reports/:reportId -- get a single report with result
reportRouter.get(
  '/:reportId',
  validate(reportIdParamSchema, 'params'),
  getReport,
);

export { reportRouter };
