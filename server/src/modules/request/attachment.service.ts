import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { Attachment, IAttachmentDocument, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from './attachment.model.js';
import { Request as RequestModel } from './request.model.js';
import { createAuditEntry } from '../audit/audit.utils.js';
import { User } from '../auth/auth.model.js';
import { NotFoundError, ForbiddenError, ValidationError, AppError } from '../../shared/errors.js';
import { emitToProgram } from '../../config/socket.js';
import { enqueueWebhookEvent } from '../webhook/webhook.service.js';
import type { SocketEventPayload } from '../../shared/socketEvents.js';
import type { Role } from '../../shared/types.js';
import type { ListAttachmentsQuery } from './attachment.schema.js';

/**
 * Look up a user's display name for socket event payloads.
 */
async function getPerformerName(userId: string): Promise<{ userId: string; name: string }> {
  const user = await User.findById(userId).select('firstName lastName').lean();
  return {
    userId,
    name: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
  };
}

// ---------------------------------------------------------------------------
// Multer storage configuration
// ---------------------------------------------------------------------------

const uploadDir = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists at startup
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Unique filename: nanoid + timestamp + original extension
    const ext = path.extname(file.originalname);
    cb(null, `${nanoid()}-${Date.now()}${ext}`);
  },
});

/**
 * Multer upload middleware configured with disk storage,
 * file size limit, and MIME type filter.
 */
export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if ((ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(`File type ${file.mimetype} is not allowed`, 400) as unknown as Error);
    }
  },
});

// ---------------------------------------------------------------------------
// Attachment service functions
// ---------------------------------------------------------------------------

/**
 * Upload a file attachment to a request.
 * Validates request existence, file type/size, stores on disk, creates DB record.
 */
export async function uploadAttachment(
  requestId: string,
  file: Express.Multer.File,
  uploadedBy: string,
  programId: string,
): Promise<IAttachmentDocument> {
  // Verify request exists
  const request = await RequestModel.findById(requestId);
  if (!request) {
    throw new NotFoundError('Request not found');
  }

  // Double-check MIME type (multer fileFilter should catch this, but belt-and-suspenders)
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    throw new ValidationError(`File type ${file.mimetype} is not allowed`);
  }

  // Double-check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError(`File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)} MB`);
  }

  // Create attachment record
  const attachment = await Attachment.create({
    requestId,
    uploadedBy,
    originalName: file.originalname,
    storagePath: file.path,
    mimeType: file.mimetype,
    size: file.size,
  });

  // Audit log: attachment uploaded
  await createAuditEntry({
    action: 'attachment.uploaded',
    entityType: 'attachment',
    entityId: attachment._id.toString(),
    requestId,
    programId,
    performedBy: uploadedBy,
    after: {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    },
  });

  // Emit real-time event + webhook (fire-and-forget)
  getPerformerName(uploadedBy).then((performer) => {
    emitToProgram(programId, 'attachment:uploaded', {
      event: 'attachment:uploaded',
      programId,
      requestId,
      data: { attachment: attachment.toObject() },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    enqueueWebhookEvent('attachment.uploaded', {
      eventType: 'attachment.uploaded',
      programId,
      requestId,
      data: { attachment: attachment.toObject() },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    // No notification for attachment upload (low signal-to-noise)
  }).catch(() => {});

  return attachment;
}

/**
 * Get paginated attachments for a request, sorted by createdAt descending (newest first).
 */
export async function getAttachments(
  requestId: string,
  query: ListAttachmentsQuery,
) {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [attachments, total] = await Promise.all([
    Attachment.find({ requestId })
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Attachment.countDocuments({ requestId }),
  ]);

  return { attachments, total, page, limit };
}

/**
 * Get a single attachment by ID and requestId for download.
 */
export async function getAttachmentById(
  attachmentId: string,
  requestId: string,
): Promise<IAttachmentDocument> {
  const attachment = await Attachment.findOne({ _id: attachmentId, requestId });

  if (!attachment) {
    throw new NotFoundError('Attachment not found');
  }

  return attachment;
}

/**
 * Delete an attachment.
 * Only the uploader or an admin/manager can delete.
 * Removes file from disk and deletes the DB record.
 */
export async function deleteAttachment(
  attachmentId: string,
  requestId: string,
  userId: string,
  userRole: Role,
  programId: string,
): Promise<void> {
  const attachment = await Attachment.findOne({ _id: attachmentId, requestId });

  if (!attachment) {
    throw new NotFoundError('Attachment not found');
  }

  // Authorization: client users can only delete their own attachments
  if (userRole === 'client' && attachment.uploadedBy.toString() !== userId) {
    throw new ForbiddenError('You can only delete your own attachments');
  }

  // For non-client roles: only uploader or admin/manager can delete
  const isUploader = attachment.uploadedBy.toString() === userId;
  const isPrivileged = ['admin', 'manager'].includes(userRole);

  if (!isUploader && !isPrivileged) {
    throw new ForbiddenError('Only the uploader or an admin/manager can delete this attachment');
  }

  // Delete file from disk (ignore if already gone)
  try {
    await fs.promises.unlink(attachment.storagePath);
  } catch {
    // File may already be deleted -- not an error
  }

  // Delete the DB record
  await Attachment.findByIdAndDelete(attachmentId);

  // Audit log: attachment deleted
  await createAuditEntry({
    action: 'attachment.deleted',
    entityType: 'attachment',
    entityId: attachmentId,
    requestId,
    programId,
    performedBy: userId,
    before: { originalName: attachment.originalName },
  });

  // Emit real-time event + webhook (fire-and-forget)
  getPerformerName(userId).then((performer) => {
    emitToProgram(programId, 'attachment:deleted', {
      event: 'attachment:deleted',
      programId,
      requestId,
      data: { attachmentId },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    enqueueWebhookEvent('attachment.deleted', {
      eventType: 'attachment.deleted',
      programId,
      requestId,
      data: { attachmentId },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    // No notification for attachment deletion
  }).catch(() => {});
}
