import type { Request, Response, NextFunction } from 'express';
import * as chainService from './chain.service.js';
import { paginatedResponse } from '../../middleware/pagination.js';
import type { Role } from '../../shared/types.js';

/**
 * POST /api/v1/programs/:programId/chains
 * Create a new request chain within a program.
 */
export async function create(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const chain = await chainService.createChain(
      req.body,
      req.user!._id,
      req.params.programId as string,
    );
    res.status(201).json({ data: chain });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/programs/:programId/chains
 * List chains for a program with pagination.
 */
export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { chains, total, page, limit } = await chainService.getChainsByProgram(
      req.params.programId as string,
      req.query as any,
    );
    res.status(200).json(paginatedResponse(chains as any[], total, page, limit));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/programs/:programId/chains/:chainId
 * Get a single chain by ID.
 */
export async function getById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const chain = await chainService.getChainById(
      req.params.chainId as string,
    );
    res.status(200).json({ data: chain });
  } catch (err) {
    next(err);
  }
}
