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
