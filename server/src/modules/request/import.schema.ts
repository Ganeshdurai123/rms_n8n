import { z } from 'zod';

/**
 * MongoDB ObjectId regex pattern for string validation.
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema for file upload params (programId comes from route params).
 * The actual file is handled by multer middleware, not Zod.
 */
export const uploadImportSchema = z.object({
  programId: z.string().regex(objectIdRegex, 'Invalid program ID'),
});

export type UploadImportInput = z.infer<typeof uploadImportSchema>;

/**
 * Schema for validating mapped import data against program fields.
 * columnMapping maps file column header names to program field definition keys.
 * titleColumn specifies which file column maps to the request title.
 * descriptionColumn optionally specifies which file column maps to description.
 */
export const validateImportSchema = z.object({
  importJobId: z.string().regex(objectIdRegex, 'Invalid import job ID'),
  columnMapping: z.record(z.string(), z.string()),
  titleColumn: z.string().min(1, 'Title column is required'),
  descriptionColumn: z.string().optional(),
});

export type ValidateImportInput = z.infer<typeof validateImportSchema>;

/**
 * Schema for executing a validated import (batch-creating draft requests).
 */
export const executeImportSchema = z.object({
  importJobId: z.string().regex(objectIdRegex, 'Invalid import job ID'),
});

export type ExecuteImportInput = z.infer<typeof executeImportSchema>;

/**
 * Schema for listing import history with pagination.
 */
export const listImportHistorySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListImportHistoryQuery = z.infer<typeof listImportHistorySchema>;
