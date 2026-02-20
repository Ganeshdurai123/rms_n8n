import type { Request, Response, NextFunction } from 'express';
import * as userService from './user.service.js';
import { paginatedResponse } from '../../middleware/pagination.js';

/**
 * POST /api/v1/users
 * Admin creates a new user with explicit role assignment.
 */
export async function createUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await userService.createUser(req.body, req.user!._id);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/users
 * Admin views paginated list of all users with optional filters.
 */
export async function getUsers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { users, total, page, limit } = await userService.getUsers(req.query as any);
    res.status(200).json(paginatedResponse(users, total, page, limit));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/users/:userId
 * Admin views a single user's details including program memberships.
 */
export async function getUserById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await userService.getUserById(req.params.userId as string);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/users/:userId
 * Admin updates a user's details (name, email, role, isActive).
 */
export async function updateUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await userService.updateUser(req.params.userId as string, req.body);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/users/:userId
 * Admin deactivates a user account (soft delete, not hard delete).
 * Preserves audit trail and revokes all refresh tokens.
 */
export async function deactivateUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await userService.deactivateUser(req.params.userId as string);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/users/program-assignments
 * Admin assigns a user to a program with a program-level role.
 */
export async function assignToProgram(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const membership = await userService.assignToProgram(
      req.body,
      req.user!._id,
    );
    res.status(201).json({ membership });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/users/program-assignments/:userId/:programId
 * Admin removes a user's membership from a program.
 */
export async function removeFromProgram(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await userService.removeFromProgram(
      req.params.userId as string,
      req.params.programId as string,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
