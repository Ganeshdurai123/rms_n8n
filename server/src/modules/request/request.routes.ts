import { Router } from 'express';
import * as requestController from './request.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeProgram } from '../../middleware/authorizeProgram.js';
import { validate } from '../../middleware/validate.js';
import {
  createRequestSchema,
  updateRequestSchema,
  transitionRequestSchema,
  assignRequestSchema,
  listRequestsQuerySchema,
  requestParamsSchema,
} from './request.schema.js';
import { commentRouter } from './comment.routes.js';
import { attachmentRouter } from './attachment.routes.js';
import { importRouter } from './import.routes.js';
import { listAuditLogsQuerySchema } from '../audit/audit.schema.js';

const router = Router({ mergeParams: true });

// All routes require authentication
router.use(authenticate);

// All routes require program access (any program member or admin)
router.use(authorizeProgram());

// POST /programs/:programId/requests -- create request (all program members)
router.post(
  '/',
  validate(createRequestSchema),
  requestController.create,
);

// GET /programs/:programId/requests -- list requests (all program members, access-scoped)
router.get(
  '/',
  validate(listRequestsQuerySchema, 'query'),
  requestController.list,
);

// GET /programs/:programId/requests/export -- CSV export (before /:requestId to prevent misparse)
router.get(
  '/export',
  validate(listRequestsQuerySchema, 'query'),
  requestController.exportCsv,
);

// GET /programs/:programId/requests/compliance-review -- compliance review aggregation (before /:requestId to prevent misparse)
router.get(
  '/compliance-review',
  requestController.getComplianceReview,
);

// Mount import sub-resource routes (before /:requestId to prevent 'import' being parsed as requestId)
// Restricted to manager role (admin bypasses authorizeProgram automatically)
router.use('/import', authorizeProgram({ roles: ['manager'] }), importRouter);

// GET /programs/:programId/requests/:requestId -- get single request
router.get(
  '/:requestId',
  validate(requestParamsSchema, 'params'),
  requestController.getById,
);

// PATCH /programs/:programId/requests/:requestId -- update request fields (draft only)
router.patch(
  '/:requestId',
  validate(requestParamsSchema, 'params'),
  validate(updateRequestSchema),
  requestController.update,
);

// DELETE /programs/:programId/requests/:requestId -- delete draft request (creator or admin)
router.delete(
  '/:requestId',
  validate(requestParamsSchema, 'params'),
  requestController.remove,
);

// PATCH /programs/:programId/requests/:requestId/transition -- change status
router.patch(
  '/:requestId/transition',
  validate(requestParamsSchema, 'params'),
  validate(transitionRequestSchema),
  requestController.transition,
);

// PATCH /programs/:programId/requests/:requestId/assign -- assign/reassign (managers only)
router.patch(
  '/:requestId/assign',
  validate(requestParamsSchema, 'params'),
  validate(assignRequestSchema),
  authorizeProgram({ roles: ['manager'] }),
  requestController.assign,
);

// GET /programs/:programId/requests/:requestId/detail -- aggregated request detail
router.get(
  '/:requestId/detail',
  validate(requestParamsSchema, 'params'),
  requestController.getDetail,
);

// GET /programs/:programId/requests/:requestId/audit -- per-request audit trail (any program member)
router.get(
  '/:requestId/audit',
  validate(requestParamsSchema, 'params'),
  validate(listAuditLogsQuerySchema, 'query'),
  requestController.getAuditTrail,
);

// Mount comment sub-resource routes
router.use('/:requestId/comments', commentRouter);

// Mount attachment sub-resource routes
router.use('/:requestId/attachments', attachmentRouter);

export { router as requestRouter };
