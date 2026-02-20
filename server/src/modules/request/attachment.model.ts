import mongoose, { Schema, Document } from 'mongoose';

/**
 * Allowed MIME types for file uploads.
 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
] as const;

/**
 * Maximum file size in bytes (10 MB).
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Attachment document interface.
 * Attachments store file metadata and are linked to requests.
 */
export interface IAttachmentDocument extends Document {
  _id: mongoose.Types.ObjectId;
  requestId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Attachment schema -- file metadata for uploads associated with a request.
 */
const attachmentSchema = new Schema<IAttachmentDocument>(
  {
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'Request',
      required: [true, 'Request ID is required'],
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploaded by user is required'],
    },
    originalName: {
      type: String,
      required: [true, 'Original filename is required'],
    },
    storagePath: {
      type: String,
      required: [true, 'Storage path is required'],
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
    },
    size: {
      type: Number,
      required: [true, 'File size is required'],
    },
  },
  {
    timestamps: true,
  },
);

// Index for listing attachments by request in reverse chronological order
attachmentSchema.index({ requestId: 1, createdAt: -1 });

export const Attachment = mongoose.model<IAttachmentDocument>(
  'Attachment',
  attachmentSchema,
);
