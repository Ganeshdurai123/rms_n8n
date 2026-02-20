import type { Request, Response, NextFunction } from 'express';
import passport from '../config/passport.js';
import { UnauthorizedError } from '../shared/errors.js';
import type { IUser } from '../shared/types.js';

/**
 * Authentication middleware using Passport JWT strategy.
 * Returns JSON 401 on failure instead of Passport's default text response.
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  passport.authenticate(
    'jwt',
    { session: false },
    (err: Error | null, user: IUser | false) => {
      if (err) return next(err);
      if (!user) return next(new UnauthorizedError('Authentication required'));
      req.user = user;
      next();
    },
  )(req, res, next);
};
