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

// All user management routes are admin-only
router.use(authenticate);
router.use(authorize('admin'));

// User CRUD
router.post('/', validate(createUserSchema), userController.createUser);
router.get(
  '/',
  validate(listUsersQuerySchema, 'query'),
  paginate(),
  userController.getUsers,
);
router.get('/:userId', userController.getUserById);
router.patch(
  '/:userId',
  validate(updateUserSchema),
  userController.updateUser,
);
router.delete('/:userId', userController.deactivateUser); // Soft delete (deactivate)
router.delete('/:userId/permanent', userController.hardDeleteUser); // Hard delete

// Program assignment
router.post(
  '/program-assignments',
  validate(assignProgramSchema),
  userController.assignToProgram,
);
router.delete(
  '/program-assignments/:userId/:programId',
  userController.removeFromProgram,
);

export { router as userRouter };
