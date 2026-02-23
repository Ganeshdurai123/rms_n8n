import { Request } from './request.model.js';
import { Comment } from './comment.model.js';
import { Attachment } from './attachment.model.js';
import { AuditLog } from '../audit/auditLog.model.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors.js';
import type { Role } from '../../shared/types.js';

/**
 * Get aggregated request detail with comments, attachments, and audit trail.
 * Runs 4 parallel queries for optimal performance.
 * Client role users can only view detail for requests they created.
 */
export async function getRequestDetail(requestId: string, userId: string, userRole: Role) {
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

  // Client ownership enforcement: clients can only view their own requests
  if (userRole === 'client') {
    const createdById = (request.createdBy as unknown as { _id: { toString(): string } })._id?.toString()
      ?? (request.createdBy as unknown as string).toString();
    if (createdById !== userId) {
      throw new ForbiddenError('You can only view your own requests');
    }
  }

  return { request, comments, attachments, auditTrail };
}
