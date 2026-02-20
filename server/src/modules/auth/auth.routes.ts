import { Router } from 'express';
import * as authController from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { registerSchema, loginSchema } from './auth.schema.js';

const router = Router();

// Public routes (no auth required)
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh); // Uses HttpOnly cookie
router.post('/logout', authController.logout); // Uses HttpOnly cookie for identity

// Protected routes
router.get('/me', authenticate, authController.me);

export { router as authRouter };
