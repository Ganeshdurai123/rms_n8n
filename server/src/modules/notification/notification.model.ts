import mongoose, { Schema, Document } from 'mongoose';

/**
 * All notification types covering request lifecycle events.
 */
export const NOTIFICATION_TYPES = [
  'request.status_changed',
  'request.assigned',
  'request.created',
  'request.updated',
  'comment.added',
  'attachment.uploaded',
  'reminder',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Full Notification document interface.
 */
export interface INotificationDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  programId?: mongoose.Types.ObjectId;
  requestId?: mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Notification schema -- stores per-user in-app notifications with type,
 * read status, and optional program/request references.
 */
const notificationSchema = new Schema<INotificationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
    },
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'Request',
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for efficient querying
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 }); // list query (paginated, sorted)
notificationSchema.index({ userId: 1, isRead: 1 }); // unread count query

export const Notification = mongoose.model<INotificationDocument>(
  'Notification',
  notificationSchema,
);
