import type { Request, Response, NextFunction } from 'express';
import * as commentService from './comment.service.js';
import { paginatedResponse } from '../../middleware/pagination.js';
import type { Role } from '../../shared/types.js';

/**
 * POST /programs/:programId/requests/:requestId/comments
 * Add a comment to a request.
 */
export async function add(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const comment = await commentService.addComment(
      req.params.requestId as string,
      req.body.content,
      req.user!._id,
      req.params.programId as string,
    );
    res.status(201).json({ data: comment });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /programs/:programId/requests/:requestId/comments
 * List comments for a request with pagination.
 */
export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { comments, total, page, limit } = await commentService.getComments(
      req.params.requestId as string,
      req.query as any,
    );
    res.status(200).json(paginatedResponse(comments as any[], total, page, limit));
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /programs/:programId/requests/:requestId/comments/:commentId
 * Delete a comment. Only author or admin/manager.
 */
export async function remove(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await commentService.deleteComment(
      req.params.commentId as string,
      req.params.requestId as string,
      req.user!._id,
      req.user!.role as Role,
      req.params.programId as string,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
