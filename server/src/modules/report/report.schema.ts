import { z } from 'zod';

/**
 * MongoDB ObjectId regex pattern for string validation.
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema for POST /reports body -- create a new report job.
 * programId is required when type='program' (enforced via refine).
 */
export const createReportSchema = z
  .object({
    type: z.enum(['summary', 'program', 'overdue']),
    programId: z
      .string()
      .regex(objectIdRegex, 'Invalid program ID')
      .optional(),
    params: z
      .object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'program' && !data.programId) {
        return false;
      }
      return true;
    },
    {
      message: 'programId is required when type is "program"',
      path: ['programId'],
    },
  );

export type CreateReportBody = z.infer<typeof createReportSchema>;

/**
 * Schema for GET /reports query -- list reports with pagination and filters.
 */
export const listReportsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['summary', 'program', 'overdue']).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
});

export type ListReportsQuery = z.infer<typeof listReportsSchema>;

/**
 * Schema for :reportId param validation.
 */
export const reportIdParamSchema = z.object({
  reportId: z.string().regex(objectIdRegex, 'Invalid report ID'),
});

export type ReportIdParams = z.infer<typeof reportIdParamSchema>;
