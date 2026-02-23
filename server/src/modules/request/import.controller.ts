import type { Request, Response, NextFunction } from 'express';
import * as importService from './import.service.js';
import { paginatedResponse } from '../../middleware/pagination.js';
import { AppError } from '../../shared/errors.js';
import type { Role } from '../../shared/types.js';

/**
 * POST /api/v1/programs/:programId/requests/import
 * Upload an Excel/CSV file, parse it, and return column headers + sample data.
 */
export async function upload(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const result = await importService.parseUploadedFile(
      req.file.path,
      req.file.originalname,
      req.params.programId as string,
      req.user!._id,
    );

    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/programs/:programId/requests/import/validate
 * Validate mapped import data against program field definitions.
 */
export async function validatePreview(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { importJobId, columnMapping, titleColumn, descriptionColumn } = req.body;

    const result = await importService.validateImportRows(
      importJobId,
      columnMapping,
      titleColumn,
      descriptionColumn,
    );

    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/programs/:programId/requests/import/execute
 * Execute batch import -- create draft requests for all valid rows.
 */
export async function executeImport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await importService.executeBatchImport(
      req.body.importJobId,
      req.user!._id,
      req.user!.role as Role,
    );

    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/programs/:programId/requests/import/history
 * List paginated import history for a program.
 */
export async function listHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const { imports, total } = await importService.getImportHistory(
      req.params.programId as string,
      page,
      limit,
    );

    res.status(200).json(paginatedResponse(imports as any[], total, page, limit));
  } catch (err) {
    next(err);
  }
}
