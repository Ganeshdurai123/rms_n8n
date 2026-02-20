import { Router } from 'express';
import * as attachmentController from './attachment.controller.js';
import { upload } from './attachment.service.js';
import { validate } from '../../middleware/validate.js';
import {
  listAttachmentsQuerySchema,
  attachmentParamsSchema,
} from './attachment.schema.js';

const router = Router({ mergeParams: true });

// No auth middleware here -- inherited from parent request router

// POST /programs/:programId/requests/:requestId/attachments -- upload file
router.post(
  '/',
  upload.single('file'),
  attachmentController.uploadFile,
);

// GET /programs/:programId/requests/:requestId/attachments -- list attachments
router.get(
  '/',
  validate(listAttachmentsQuerySchema, 'query'),
  attachmentController.list,
);

// GET /programs/:programId/requests/:requestId/attachments/:attachmentId -- download file
router.get(
  '/:attachmentId',
  validate(attachmentParamsSchema, 'params'),
  attachmentController.download,
);

// DELETE /programs/:programId/requests/:requestId/attachments/:attachmentId -- delete attachment
router.delete(
  '/:attachmentId',
  validate(attachmentParamsSchema, 'params'),
  attachmentController.remove,
);

export { router as attachmentRouter };
