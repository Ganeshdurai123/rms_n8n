import { Router } from 'express';
import * as commentController from './comment.controller.js';
import { validate } from '../../middleware/validate.js';
import {
  addCommentSchema,
  listCommentsQuerySchema,
  commentParamsSchema,
} from './comment.schema.js';

const router = Router({ mergeParams: true });

// No auth middleware here -- inherited from parent request router

// POST /programs/:programId/requests/:requestId/comments -- add comment
router.post(
  '/',
  validate(addCommentSchema),
  commentController.add,
);

// GET /programs/:programId/requests/:requestId/comments -- list comments
router.get(
  '/',
  validate(listCommentsQuerySchema, 'query'),
  commentController.list,
);

// DELETE /programs/:programId/requests/:requestId/comments/:commentId -- delete comment
router.delete(
  '/:commentId',
  validate(commentParamsSchema, 'params'),
  commentController.remove,
);

export { router as commentRouter };
