import { Router } from 'express';
import * as programController from './program.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { paginate } from '../../middleware/pagination.js';
import {
  createProgramSchema,
  updateProgramSchema,
  listProgramsQuerySchema,
} from './program.schema.js';

const router = Router();

// All program routes require authentication and admin/manager role
router.use(authenticate);
router.use(authorize('admin', 'manager'));

// Program CRUD
router.post('/', validate(createProgramSchema), programController.createProgram);
router.get(
  '/',
  validate(listProgramsQuerySchema, 'query'),
  paginate(),
  programController.getPrograms,
);
router.get('/:programId', programController.getProgramById);
router.patch(
  '/:programId',
  validate(updateProgramSchema),
  programController.updateProgram,
);
router.patch('/:programId/archive', programController.archiveProgram);

export { router as programRouter };
