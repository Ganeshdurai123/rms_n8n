import { Router } from 'express';
import * as auditController from './audit.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { listAuditLogsQuerySchema } from './audit.schema.js';

const router = Router();

// Admin-only audit log view
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/v1/admin/audit -- list audit logs with filtering
router.get(
  '/',
  validate(listAuditLogsQuerySchema, 'query'),
  auditController.listAuditLogs,
);

export { router as auditRouter };
