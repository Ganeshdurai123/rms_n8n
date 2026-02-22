import mongoose, { Schema, Document } from 'mongoose';
import { WEBHOOK_EVENT_TYPES } from './webhook.types.js';
import type { WebhookEventType, WebhookPayload } from './webhook.types.js';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * WebhookEvent document -- each row is an outbox entry tracking delivery
 * of a single webhook event to n8n.
 */
export interface IWebhookEventDocument extends Document {
  _id: mongoose.Types.ObjectId;
  eventType: WebhookEventType;
  payload: WebhookPayload;
  status: 'pending' | 'sent' | 'failed';
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  sentAt?: Date;
  nextRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const webhookEventSchema = new Schema<IWebhookEventDocument>(
  {
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      enum: {
        values: WEBHOOK_EVENT_TYPES,
        message: 'Invalid webhook event type: {VALUE}',
      },
    },
    payload: {
      type: Schema.Types.Mixed,
      required: [true, 'Payload is required'],
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
    lastError: {
      type: String,
    },
    sentAt: {
      type: Date,
    },
    nextRetryAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient outbox polling and TTL cleanup
webhookEventSchema.index({ status: 1, nextRetryAt: 1 });
webhookEventSchema.index({ createdAt: 1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const WebhookEvent = mongoose.model<IWebhookEventDocument>(
  'WebhookEvent',
  webhookEventSchema,
);
