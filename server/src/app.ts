import express, { Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import passport from './config/passport.js';
import { NotFoundError } from './shared/errors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { userRouter } from './modules/user/user.routes.js';
import { programRouter } from './modules/program/program.routes.js';
import { requestRouter } from './modules/request/request.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { notificationRouter } from './modules/notification/notification.routes.js';
import { internalRouter } from './modules/internal/internal.routes.js';
import { chainRouter } from './modules/chain/chain.routes.js';

const app = express();

// 1. Security headers
app.use(helmet());

// 2. CORS with validated CLIENT_URL (not '*') for cookie-based auth
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  }),
);

// 3. Gzip compression
app.use(compression());

// 4. JSON body parsing
app.use(express.json({ limit: '10mb' }));

// 5. URL-encoded parsing
app.use(express.urlencoded({ extended: true }));

// 6. Cookie parsing (needed for HttpOnly refresh token cookies)
app.use(cookieParser());

// 7. Request logging (dev mode)
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// 8. Passport initialization (JWT strategy, no sessions)
app.use(passport.initialize());

// 9. Health check route
app.get('/api/v1/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 10. API router placeholder
const apiRouter = Router();
app.use('/api/v1', apiRouter);

// 11. Auth routes
app.use('/api/v1/auth', authRouter);

// 12. User management routes (admin-only, requires auth + authorize)
app.use('/api/v1/users', userRouter);

// 13. Program management routes (admin/manager, requires auth + authorize)
app.use('/api/v1/programs', programRouter);

// 14. Request routes (nested under programs, uses mergeParams)
app.use('/api/v1/programs/:programId/requests', requestRouter);

// 14b. Chain routes (sibling resource under programs, uses mergeParams)
app.use('/api/v1/programs/:programId/chains', chainRouter);

// 15. Admin audit log routes (admin-only)
app.use('/api/v1/admin/audit', auditRouter);

// 16. Notification routes (authenticated users manage their own notifications)
app.use('/api/v1/notifications', notificationRouter);

// 17. Internal API routes (n8n -> Express, shared-secret auth, nginx-blocked externally)
app.use('/api/v1/internal', internalRouter);

// 18. 404 handler - any unmatched route
app.use((_req, _res, next) => {
  next(new NotFoundError('Route not found'));
});

// 19. Global error handler (must be last)
app.use(errorHandler);

export { app, apiRouter };
