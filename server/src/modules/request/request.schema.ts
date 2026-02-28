import { z } from 'zod';
import { REQUEST_STATUSES, REQUEST_PRIORITIES } from './request.model.js';

/**
 * MongoDB ObjectId regex pattern for string validation.
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema for creating a new request (POST /api/v1/programs/:programId/requests).
 * The `fields` object is validated at the service layer against the program's fieldDefinitions,
 * since field schemas are dynamic and program-specific.
 */
export const createRequestSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be at most 200 characters')
    .trim(),
  description: z
    .string()
    .max(5000, 'Description must be at most 5000 characters')
    .trim()
    .optional(),
  programId: z
    .string()
    .regex(objectIdRegex, 'Invalid program ID'),
  fields: z.record(z.string(), z.unknown()).optional(),
  priority: z.enum(REQUEST_PRIORITIES).optional(),
  dueDate: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), {
      message: 'dueDate must be a valid date string',
    })
    .optional(),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

/**
 * Schema for updating an existing request (PATCH /api/v1/programs/:programId/requests/:requestId).
 * All fields are optional except programId (cannot change program).
 * At least one field must be provided.
 */
export const updateRequestSchema = z
  .object({
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(200, 'Title must be at most 200 characters')
      .trim()
      .optional(),
    description: z
      .string()
      .max(5000, 'Description must be at most 5000 characters')
      .trim()
      .optional(),
    fields: z.record(z.string(), z.unknown()).optional(),
    priority: z.enum(REQUEST_PRIORITIES).optional(),
    dueDate: z
      .string()
      .refine((val) => !isNaN(new Date(val).getTime()), {
        message: 'dueDate must be a valid date string',
      })
      .optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    {
      message: 'At least one field must be provided for update',
    },
  );

export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;

/**
 * Schema for transitioning a request status (PATCH /api/v1/programs/:programId/requests/:requestId/transition).
 * Only non-draft target statuses are allowed (you cannot transition TO draft).
 */
export const transitionRequestSchema = z.object({
  status: z.enum(['submitted', 'in_review', 'approved', 'rejected', 'completed']),
});

export type TransitionRequestInput = z.infer<typeof transitionRequestSchema>;

/**
 * Schema for assigning a request (PATCH /api/v1/programs/:programId/requests/:requestId/assign).
 */
export const assignRequestSchema = z.object({
  assignedTo: z.string().regex(objectIdRegex, 'Invalid user ID'),
});

export type AssignRequestInput = z.infer<typeof assignRequestSchema>;

/**
 * Schema for query parameters when listing requests.
 * Supports pagination, status/priority/assignment filtering, text search,
 * sorting, date range filtering, and custom field filtering.
 */
export const listRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(REQUEST_STATUSES).optional(),
  assignedTo: z.string().regex(objectIdRegex, 'Invalid user ID').optional(),
  priority: z.enum(REQUEST_PRIORITIES).optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['title', 'status', 'priority', 'createdAt', 'updatedAt', 'assignedTo', 'dueDate', 'chainSequence']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
  chainId: z.string().regex(objectIdRegex, 'Invalid chain ID').optional(),
  fields: z.record(z.string(), z.string()).optional(),
});

export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;

/**
 * Schema for request route parameters (programId + requestId).
 */
export const requestParamsSchema = z.object({
  programId: z.string().regex(objectIdRegex, 'Invalid program ID'),
  requestId: z.string().regex(objectIdRegex, 'Invalid request ID'),
});

export type RequestParams = z.infer<typeof requestParamsSchema>;
