import { env } from '../../config/env.js';
import logger from '../../config/logger.js';
import { WebhookEvent } from './webhookEvent.model.js';
import type { IWebhookEventDocument } from './webhookEvent.model.js';
import type { WebhookEventType, WebhookPayload } from './webhook.types.js';

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

/**
 * Create a pending outbox entry for a webhook event.
 *
 * Fire-and-forget pattern: catches errors, logs, returns null on failure
 * (matches audit.utils.ts pattern).
 */
export async function enqueueWebhookEvent(
  eventType: WebhookEventType,
  payload: WebhookPayload,
): Promise<IWebhookEventDocument | null> {
  try {
    const event = await WebhookEvent.create({
      eventType,
      payload,
      status: 'pending',
    });
    return event;
  } catch (error) {
    logger.error('Failed to enqueue webhook event', {
      error: error instanceof Error ? error.message : String(error),
      eventType,
      requestId: payload.requestId,
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Outbox Processor
// ---------------------------------------------------------------------------

/**
 * Process all pending and retryable webhook events from the outbox.
 *
 * For each event, POSTs to `N8N_WEBHOOK_BASE_URL/{eventType}` with a shared
 * secret header. On success marks as sent; on failure increments retryCount
 * with exponential backoff.
 */
export async function processOutbox(): Promise<void> {
  if (!env.N8N_WEBHOOK_BASE_URL) {
    logger.debug('N8N_WEBHOOK_BASE_URL not set -- skipping outbox dispatch');
    return;
  }

  const now = new Date();

  const events = await WebhookEvent.find({
    $or: [
      { status: 'pending' },
      {
        status: 'failed',
        $expr: { $lt: ['$retryCount', '$maxRetries'] },
        nextRetryAt: { $lte: now },
      },
    ],
  });

  for (const event of events) {
    const url = `${env.N8N_WEBHOOK_BASE_URL}/${event.eventType}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': env.N8N_WEBHOOK_SECRET ?? '',
        },
        body: JSON.stringify(event.payload),
      });

      if (response.ok) {
        event.status = 'sent';
        event.sentAt = new Date();
        await event.save();
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        await markFailed(event, `HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markFailed(event, message);
    }
  }
}

/**
 * Mark an event as failed with exponential backoff for retry scheduling.
 */
async function markFailed(
  event: IWebhookEventDocument,
  errorMessage: string,
): Promise<void> {
  event.retryCount += 1;
  event.lastError = errorMessage;
  event.status = 'failed';
  // Exponential backoff: retryCount * 30 seconds
  event.nextRetryAt = new Date(Date.now() + event.retryCount * 30_000);
  await event.save();

  logger.warn(`Webhook delivery failed for event ${event._id}`, {
    eventType: event.eventType,
    retryCount: event.retryCount,
    maxRetries: event.maxRetries,
    error: errorMessage,
  });
}

// ---------------------------------------------------------------------------
// Interval-based processor
// ---------------------------------------------------------------------------

/**
 * Start the outbox processor on a recurring interval.
 *
 * Only starts if `N8N_WEBHOOK_BASE_URL` is defined (skip in dev without n8n).
 * Returns the interval handle for cleanup, or null if not started.
 */
export function startOutboxProcessor(
  intervalMs = 10_000,
): NodeJS.Timeout | null {
  if (!env.N8N_WEBHOOK_BASE_URL) {
    logger.info('N8N_WEBHOOK_BASE_URL not set -- outbox processor disabled');
    return null;
  }

  logger.info(`Outbox processor started (interval: ${intervalMs}ms)`);

  const handle = setInterval(() => {
    processOutbox().catch((err) => {
      logger.error('Outbox processor error:', err);
    });
  }, intervalMs);

  return handle;
}

/**
 * Stop the outbox processor interval.
 */
export function stopOutboxProcessor(handle: NodeJS.Timeout): void {
  clearInterval(handle);
  logger.info('Outbox processor stopped');
}
