import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ProgramMember } from '../modules/user/programMember.model.js';
import { ValidationError, ForbiddenError } from '../shared/errors.js';
import type { ProgramRole } from '../shared/types.js';

/**
 * Program-scoped authorization middleware factory.
 *
 * Checks if the authenticated user has access to the program specified by
 * req.params.programId. Admin role ALWAYS bypasses (implicit access to all programs).
 * For other roles, checks ProgramMember collection for active membership.
 * Optionally checks for a specific program-level role.
 *
 * Must be used AFTER authenticate middleware (req.user must exist).
 *
 * Per ARCHITECTURE.md Pattern 3: centralized program-level permission check.
 * Per PITFALLS.md Pitfall 4: no inline role checks -- this middleware is the
 * single source of truth for program access.
 */
export function authorizeProgram(options?: { roles?: ProgramRole[] }) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const programId = req.params.programId as string | undefined;

      // Validate programId exists and is a valid ObjectId
      if (!programId || typeof programId !== 'string' || !mongoose.Types.ObjectId.isValid(programId)) {
        return next(new ValidationError('Invalid program ID'));
      }

      // Admin bypasses all program-level checks
      if (req.user && req.user.role === 'admin') {
        return next();
      }

      // For non-admin users, check ProgramMember collection
      const membership = await ProgramMember.findOne({
        userId: req.user!._id,
        programId,
        isActive: true,
      }).lean();

      if (!membership) {
        return next(new ForbiddenError('No access to this program'));
      }

      // If specific program roles are required, check membership role
      if (options?.roles && options.roles.length > 0) {
        if (!options.roles.includes(membership.role as ProgramRole)) {
          return next(new ForbiddenError('Insufficient program permissions'));
        }
      }

      // Attach membership to request for downstream use
      req.programMembership = {
        userId: membership.userId.toString(),
        programId: membership.programId.toString(),
        role: membership.role as ProgramRole,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}
