import { z } from 'zod';

/**
 * MongoDB ObjectId regex pattern for string validation.
 */
const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Schema for creating a new chain (POST /api/v1/programs/:programId/chains).
 * A chain needs at least 2 steps (otherwise it's not a sequence).
 */
export const createChainSchema = z.object({
  name: z
    .string()
    .min(3, 'Chain name must be at least 3 characters')
    .max(100, 'Chain name must be at most 100 characters')
    .trim(),
  steps: z
    .array(
      z.object({
        requestId: z.string().regex(objectIdRegex, 'Invalid request ID'),
        sequence: z.number().int().min(1, 'Sequence must be at least 1'),
      }),
    )
    .min(2, 'A chain must have at least 2 steps'),
});

export type CreateChainInput = z.infer<typeof createChainSchema>;

/**
 * Schema for chain route parameters (programId + chainId).
 */
export const chainParamsSchema = z.object({
  programId: z.string().regex(objectIdRegex, 'Invalid program ID'),
  chainId: z.string().regex(objectIdRegex, 'Invalid chain ID'),
});

export type ChainParams = z.infer<typeof chainParamsSchema>;

/**
 * Schema for query parameters when listing chains.
 * Standard pagination with sensible defaults.
 */
export const listChainsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListChainsQuery = z.infer<typeof listChainsQuerySchema>;
