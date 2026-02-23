import { Router } from 'express';
import * as chainController from './chain.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorizeProgram } from '../../middleware/authorizeProgram.js';
import { validate } from '../../middleware/validate.js';
import {
  createChainSchema,
  chainParamsSchema,
  listChainsQuerySchema,
} from './chain.schema.js';

const router = Router({ mergeParams: true });

// All chain routes require authentication + manager role (admin bypasses automatically)
router.use(authenticate);
router.use(authorizeProgram({ roles: ['manager'] }));

// POST /programs/:programId/chains -- create chain
router.post(
  '/',
  validate(createChainSchema),
  chainController.create,
);

// GET /programs/:programId/chains -- list chains with pagination
router.get(
  '/',
  validate(listChainsQuerySchema, 'query'),
  chainController.list,
);

// GET /programs/:programId/chains/:chainId -- get single chain
router.get(
  '/:chainId',
  validate(chainParamsSchema, 'params'),
  chainController.getById,
);

export { router as chainRouter };
