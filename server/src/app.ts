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

// 12. 404 handler - any unmatched route
app.use((_req, _res, next) => {
  next(new NotFoundError('Route not found'));
});

// 13. Global error handler (must be last)
app.use(errorHandler);

export { app, apiRouter };
