import { z } from 'zod';

/**
 * MongoDB ObjectId regex pattern for string validation.
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema for listing attachments with pagination (GET query params).
 */
export const listAttachmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListAttachmentsQuery = z.infer<typeof listAttachmentsQuerySchema>;

/**
 * Schema for attachment route params (programId + requestId + attachmentId).
 */
export const attachmentParamsSchema = z.object({
  programId: z.string().regex(objectIdRegex, 'Invalid program ID'),
  requestId: z.string().regex(objectIdRegex, 'Invalid request ID'),
  attachmentId: z.string().regex(objectIdRegex, 'Invalid attachment ID'),
});

export type AttachmentParams = z.infer<typeof attachmentParamsSchema>;
