import type { Request, Response, NextFunction } from 'express';
import * as attachmentService from './attachment.service.js';
import { paginatedResponse } from '../../middleware/pagination.js';
import { ValidationError } from '../../shared/errors.js';
import type { Role } from '../../shared/types.js';

/**
 * POST /programs/:programId/requests/:requestId/attachments
 * Upload a file attachment. Multer upload.single('file') is applied in routes.
 */
export async function uploadFile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      throw new ValidationError('No file provided');
    }

    const attachment = await attachmentService.uploadAttachment(
      req.params.requestId as string,
      req.file,
      req.user!._id,
      req.params.programId as string,
    );
    res.status(201).json({ data: attachment });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /programs/:programId/requests/:requestId/attachments
 * List attachments for a request with pagination.
 */
export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { attachments, total, page, limit } = await attachmentService.getAttachments(
      req.params.requestId as string,
      req.query as any,
    );
    res.status(200).json(paginatedResponse(attachments as any[], total, page, limit));
  } catch (err) {
    next(err);
  }
}

/**
 * GET /programs/:programId/requests/:requestId/attachments/:attachmentId
 * Download an attachment file with original filename.
 */
export async function download(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const attachment = await attachmentService.getAttachmentById(
      req.params.attachmentId as string,
      req.params.requestId as string,
    );
    res.download(attachment.storagePath, attachment.originalName);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /programs/:programId/requests/:requestId/attachments/:attachmentId
 * Delete an attachment. Only uploader or admin/manager.
 */
export async function remove(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await attachmentService.deleteAttachment(
      req.params.attachmentId as string,
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
