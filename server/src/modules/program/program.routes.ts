import { Router } from 'express';
import * as programController from './program.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { authorizeProgram } from '../../middleware/authorizeProgram.js';
import { validate } from '../../middleware/validate.js';
import { paginate } from '../../middleware/pagination.js';
import {
  createProgramSchema,
  updateProgramSchema,
  listProgramsQuerySchema,
  addMemberSchema,
  listMembersQuerySchema,
} from './program.schema.js';

const router = Router();

// All program routes require authentication
router.use(authenticate);

// --- Public program routes (authenticated, role varies) ---

// POST /api/v1/programs -- admin/manager only
router.post(
  '/',
  authorize('admin', 'manager'),
  validate(createProgramSchema),
  programController.createProgram,
);

// GET /api/v1/programs -- all authenticated users (access-scoped in service layer)
router.get(
  '/',
  validate(listProgramsQuerySchema, 'query'),
  paginate(),
  programController.getPrograms,
);

// --- Program-specific routes (authenticated + authorizeProgram) ---

// GET /api/v1/programs/:programId -- any member (or admin)
router.get(
  '/:programId',
  authorizeProgram(),
  programController.getProgramById,
);

// PATCH /api/v1/programs/:programId -- admin/manager with program manager role
router.patch(
  '/:programId',
  authorize('admin', 'manager'),
  authorizeProgram({ roles: ['manager'] }),
  validate(updateProgramSchema),
  programController.updateProgram,
);

// PATCH /api/v1/programs/:programId/archive -- admin/manager with program manager role
router.patch(
  '/:programId/archive',
  authorize('admin', 'manager'),
  authorizeProgram({ roles: ['manager'] }),
  programController.archiveProgram,
);

// --- Boundary stats route (admin/manager with program manager role) ---

// GET /api/v1/programs/:programId/boundary-stats
router.get(
  '/:programId/boundary-stats',
  authorize('admin', 'manager'),
  authorizeProgram({ roles: ['manager'] }),
  programController.getBoundaryStats,
);

// --- Member management routes (admin/manager with program manager role) ---

// GET /api/v1/programs/:programId/members
router.get(
  '/:programId/members',
  authorize('admin', 'manager'),
  authorizeProgram({ roles: ['manager'] }),
  validate(listMembersQuerySchema, 'query'),
  paginate(),
  programController.getMembers,
);

// POST /api/v1/programs/:programId/members
router.post(
  '/:programId/members',
  authorize('admin', 'manager'),
  authorizeProgram({ roles: ['manager'] }),
  validate(addMemberSchema),
  programController.addMember,
);

// DELETE /api/v1/programs/:programId/members/:memberId
router.delete(
  '/:programId/members/:memberId',
  authorize('admin', 'manager'),
  authorizeProgram({ roles: ['manager'] }),
  programController.removeMember,
);

export { router as programRouter };
