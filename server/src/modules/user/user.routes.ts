import { Router } from 'express';
import * as userController from './user.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { paginate } from '../../middleware/pagination.js';
import {
  createUserSchema,
  updateUserSchema,
  assignProgramSchema,
  listUsersQuerySchema,
} from './user.schema.js';

const router = Router();

router.use(authenticate);

// List users -- accessible by admin and manager (needed for request assignment)
router.get(
  '/',
  authorize('admin', 'manager'),
  validate(listUsersQuerySchema, 'query'),
  paginate(),
  userController.getUsers,
);
router.get('/:userId', authorize('admin', 'manager'), userController.getUserById);

// Mutating user operations -- admin only
router.post('/', authorize('admin'), validate(createUserSchema), userController.createUser);
router.patch(
  '/:userId',
  authorize('admin'),
  validate(updateUserSchema),
  userController.updateUser,
);
router.delete('/:userId', authorize('admin'), userController.deactivateUser); // Soft delete (deactivate)
router.delete('/:userId/permanent', authorize('admin'), userController.hardDeleteUser); // Hard delete

// Program assignment -- admin only
router.post(
  '/program-assignments',
  authorize('admin'),
  validate(assignProgramSchema),
  userController.assignToProgram,
);
router.delete(
  '/program-assignments/:userId/:programId',
  authorize('admin'),
  userController.removeFromProgram,
);

export { router as userRouter };
