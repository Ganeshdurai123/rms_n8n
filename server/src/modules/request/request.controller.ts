import type { Request, Response, NextFunction } from 'express';
import * as requestService from './request.service.js';
import { getRequestDetail } from './requestDetail.service.js';
import { getRequestAuditTrail } from '../audit/audit.service.js';
import { getProgramById } from '../program/program.service.js';
import { paginatedResponse } from '../../middleware/pagination.js';
import type { Role } from '../../shared/types.js';

/**
 * POST /api/v1/programs/:programId/requests
 * Create a new request within a program.
 */
export async function create(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const request = await requestService.createRequest(
      { ...req.body, programId: req.params.programId as string },
      req.user!._id,
      req.user!.role as Role,
    );
    res.status(201).json({ data: request });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/programs/:programId/requests
 * List requests for a program with pagination, filtering, and access scoping.
 */
export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { requests, total, page, limit } = await requestService.getRequests(
      req.query as any,
      req.params.programId as string,
      req.user!._id,
      req.user!.role as Role,
    );
    res.status(200).json(paginatedResponse(requests as any[], total, page, limit));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/programs/:programId/requests/:requestId
 * Get a single request by ID.
 */
export async function getById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const request = await requestService.getRequestById(req.params.requestId as string);
    res.status(200).json({ data: request });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/programs/:programId/requests/:requestId
 * Update a draft request's fields and metadata.
 */
export async function update(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const request = await requestService.updateRequest(
      req.params.requestId as string,
      req.body,
      req.user!._id,
      req.user!.role as Role,
    );
    res.status(200).json({ data: request });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/programs/:programId/requests/:requestId/transition
 * Transition a request to a new status.
 */
export async function transition(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const request = await requestService.transitionRequest(
      req.params.requestId as string,
      req.body.status,
      req.user!._id,
      req.user!.role as Role,
    );
    res.status(200).json({ data: request });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/programs/:programId/requests/:requestId/assign
 * Assign or reassign a request to a team member.
 */
export async function assign(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const request = await requestService.assignRequest(
      req.params.requestId as string,
      req.body.assignedTo,
      req.user!._id,
    );
    res.status(200).json({ data: request });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/programs/:programId/requests/:requestId/detail
 * Get aggregated request detail with comments, attachments, and audit trail.
 */
export async function getDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await getRequestDetail(req.params.requestId as string);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/programs/:programId/requests/:requestId/audit
 * Get per-request audit trail (accessible to any program member).
 */
export async function getAuditTrail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { auditLogs, total, page, limit } = await getRequestAuditTrail(
      req.params.requestId as string,
      req.query as any,
    );
    res.status(200).json(paginatedResponse(auditLogs as any[], total, page, limit));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/programs/:programId/requests/export
 * Export filtered requests as CSV with dynamic field columns from program config.
 */
export async function exportCsv(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const csv = await requestService.exportRequestsCsv(
      req.query as any,
      req.params.programId as string,
      req.user!._id,
      req.user!.role as Role,
    );
    const program = await getProgramById(req.params.programId as string);
    const filename = `${program.name.replace(/[^a-z0-9]/gi, '_')}_requests_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/programs/:programId/requests/:requestId
 * Delete a draft request (creator or admin only).
 */
export async function remove(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await requestService.deleteRequest(
      req.params.requestId as string,
      req.user!._id,
      req.user!.role as Role,
    );
    res.status(200).json({ message: 'Request deleted successfully' });
  } catch (err) {
    next(err);
  }
}
