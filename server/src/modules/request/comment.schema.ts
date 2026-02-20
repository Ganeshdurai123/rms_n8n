import { z } from 'zod';

/**
 * MongoDB ObjectId regex pattern for string validation.
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema for adding a comment to a request (POST).
 */
export const addCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Comment content is required')
    .max(5000, 'Comment must be at most 5000 characters'),
});

export type AddCommentInput = z.infer<typeof addCommentSchema>;

/**
 * Schema for listing comments with pagination (GET query params).
 * Higher default limit for timeline view.
 */
export const listCommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;

/**
 * Schema for comment route params (programId + requestId + commentId).
 */
export const commentParamsSchema = z.object({
  programId: z.string().regex(objectIdRegex, 'Invalid program ID'),
  requestId: z.string().regex(objectIdRegex, 'Invalid request ID'),
  commentId: z.string().regex(objectIdRegex, 'Invalid comment ID'),
});

export type CommentParams = z.infer<typeof commentParamsSchema>;
