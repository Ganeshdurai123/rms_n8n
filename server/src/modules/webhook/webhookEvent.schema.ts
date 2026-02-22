import { z } from 'zod';

/**
 * Query schema for listing outbox events (admin debugging).
 */
export const webhookEventQuerySchema = z.object({
  status: z
    .enum(['pending', 'sent', 'failed'])
    .optional(),
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
});

export type WebhookEventQuery = z.infer<typeof webhookEventQuerySchema>;
