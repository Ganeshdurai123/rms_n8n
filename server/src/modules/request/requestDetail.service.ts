import { Request } from './request.model.js';
import { Comment } from './comment.model.js';
import { Attachment } from './attachment.model.js';
import { AuditLog } from '../audit/auditLog.model.js';
import { NotFoundError } from '../../shared/errors.js';

/**
 * Get aggregated request detail with comments, attachments, and audit trail.
 * Runs 4 parallel queries for optimal performance.
 */
export async function getRequestDetail(requestId: string) {
  const [request, comments, attachments, auditTrail] = await Promise.all([
    // 1. Request with populated references
    Request.findById(requestId)
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .populate('programId', 'name fieldDefinitions')
      .lean(),

    // 2. All comments in timeline order (oldest first)
    Comment.find({ requestId })
      .populate('authorId', 'firstName lastName email')
      .sort({ createdAt: 1 })
      .lean(),

    // 3. All attachments (newest first)
    Attachment.find({ requestId })
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean(),

    // 4. Full audit trail (newest first)
    AuditLog.find({ requestId })
      .populate('performedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  if (!request) {
    throw new NotFoundError('Request not found');
  }

  return { request, comments, attachments, auditTrail };
}
