import type { Request, Response, NextFunction } from 'express';
import * as programService from './program.service.js';
import { paginatedResponse } from '../../middleware/pagination.js';

/**
 * POST /api/v1/programs
 * Admin or manager creates a new program.
 */
export async function createProgram(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const program = await programService.createProgram(req.body, req.user!._id);
    res.status(201).json({ program });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/programs
 * Admin or manager views paginated list of programs.
 */
export async function getPrograms(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { programs, total, page, limit } = await programService.getPrograms(
      req.query as any,
    );
    res.status(200).json(paginatedResponse(programs, total, page, limit));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/programs/:programId
 * Admin or manager views a single program with all field definitions.
 */
export async function getProgramById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const program = await programService.getProgramById(
      req.params.programId as string,
    );
    res.status(200).json({ program });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/programs/:programId
 * Admin or manager updates a program's details and field definitions.
 */
export async function updateProgram(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const program = await programService.updateProgram(
      req.params.programId as string,
      req.body,
    );
    res.status(200).json({ program });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/programs/:programId/archive
 * Admin or manager archives a program (soft state change).
 */
export async function archiveProgram(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const program = await programService.archiveProgram(
      req.params.programId as string,
    );
    res.status(200).json({ program });
  } catch (err) {
    next(err);
  }
}

// --- Member Management ---

/**
 * POST /api/v1/programs/:programId/members
 * Admin or program manager adds a member to a program.
 */
export async function addMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const membership = await programService.addMember(
      req.params.programId as string,
      req.body,
      req.user!._id,
    );
    res.status(201).json({ membership });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/programs/:programId/members/:memberId
 * Admin or program manager removes a member from a program.
 */
export async function removeMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await programService.removeMember(
      req.params.programId as string,
      req.params.memberId as string,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/programs/:programId/members
 * Admin or program manager lists members of a program.
 */
export async function getMembers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { members, total, page, limit } = await programService.getMembers(
      req.params.programId as string,
      req.query as any,
    );
    res.status(200).json(paginatedResponse(members, total, page, limit));
  } catch (err) {
    next(err);
  }
}
