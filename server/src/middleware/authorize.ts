import type { Request, Response, NextFunction } from 'express';
import type { Role } from '../shared/types.js';
import { ForbiddenError } from '../shared/errors.js';

/**
 * Role-based authorization middleware factory.
 * Usage: authorize('admin', 'manager') -- allows only admin and manager roles.
 * Must be used AFTER authenticate middleware (req.user must exist).
 *
 * This is the ONLY place role checks happen in the system.
 * Never use inline `if (role === 'admin')` checks in controllers.
 * Per PITFALLS.md Pitfall 4: centralized authorization prevents scattered inline checks.
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        new ForbiddenError('Authentication required before authorization'),
      );
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}
