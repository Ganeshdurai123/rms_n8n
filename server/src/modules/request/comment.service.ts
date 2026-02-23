import { Comment, ICommentDocument } from './comment.model.js';
import { Request } from './request.model.js';
import { createAuditEntry } from '../audit/audit.utils.js';
import { User } from '../auth/auth.model.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors.js';
import { emitToProgram } from '../../config/socket.js';
import { enqueueWebhookEvent } from '../webhook/webhook.service.js';
import { createNotification } from '../notification/notification.service.js';
import type { SocketEventPayload } from '../../shared/socketEvents.js';
import type { Role } from '../../shared/types.js';
import type { ListCommentsQuery } from './comment.schema.js';

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

/**
 * Add a comment to a request.
 * Verifies request exists, creates comment, logs audit entry.
 */
export async function addComment(
  requestId: string,
  content: string,
  authorId: string,
  programId: string,
): Promise<ICommentDocument> {
  // Verify request exists
  const request = await Request.findById(requestId);
  if (!request) {
    throw new NotFoundError('Request not found');
  }

  // Create the comment
  const comment = await Comment.create({
    requestId,
    authorId,
    content,
  });

  // Populate author details for the response
  const populated = await Comment.findById(comment._id)
    .populate('authorId', 'firstName lastName email')
    .lean();

  // Audit log: comment added
  await createAuditEntry({
    action: 'comment.added',
    entityType: 'comment',
    entityId: comment._id.toString(),
    requestId,
    programId,
    performedBy: authorId,
    after: { content },
  });

  // Emit real-time event + webhook + notification (fire-and-forget)
  getPerformerName(authorId).then((performer) => {
    emitToProgram(programId, 'comment:added', {
      event: 'comment:added',
      programId,
      requestId,
      data: { comment: populated },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    enqueueWebhookEvent('comment.added', {
      eventType: 'comment.added',
      programId,
      requestId,
      data: { comment: populated },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    // Notify the request creator (if different from comment author)
    const requestCreatorId = request.createdBy.toString();
    if (requestCreatorId !== authorId) {
      createNotification({
        userId: requestCreatorId,
        type: 'comment.added',
        title: 'New comment on your request',
        message: `${performer.name} commented on "${request.title}"`,
        programId,
        requestId,
      });
    }
  }).catch(() => {});

  return populated as unknown as ICommentDocument;
}

/**
 * Get paginated comments for a request, sorted by createdAt ascending (timeline order).
 */
export async function getComments(
  requestId: string,
  query: ListCommentsQuery,
) {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [comments, total] = await Promise.all([
    Comment.find({ requestId })
      .populate('authorId', 'firstName lastName email')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Comment.countDocuments({ requestId }),
  ]);

  return { comments, total, page, limit };
}

/**
 * Delete a comment.
 * Only the comment author or an admin/manager can delete.
 */
export async function deleteComment(
  commentId: string,
  requestId: string,
  userId: string,
  userRole: Role,
  programId: string,
): Promise<void> {
  const comment = await Comment.findOne({ _id: commentId, requestId });

  if (!comment) {
    throw new NotFoundError('Comment not found');
  }

  // Authorization: client users can only delete their own comments
  if (userRole === 'client' && comment.authorId.toString() !== userId) {
    throw new ForbiddenError('You can only delete your own comments');
  }

  // For non-client roles: only author or admin/manager can delete
  const isAuthor = comment.authorId.toString() === userId;
  const isPrivileged = ['admin', 'manager'].includes(userRole);

  if (!isAuthor && !isPrivileged) {
    throw new ForbiddenError('Only the comment author or an admin/manager can delete this comment');
  }

  // Delete the comment
  await Comment.findByIdAndDelete(commentId);

  // Audit log: comment deleted
  await createAuditEntry({
    action: 'comment.deleted',
    entityType: 'comment',
    entityId: commentId,
    requestId,
    programId,
    performedBy: userId,
    before: { content: comment.content, authorId: comment.authorId.toString() },
  });

  // Emit real-time event + webhook (fire-and-forget)
  getPerformerName(userId).then((performer) => {
    emitToProgram(programId, 'comment:deleted', {
      event: 'comment:deleted',
      programId,
      requestId,
      data: { commentId },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    enqueueWebhookEvent('comment.deleted', {
      eventType: 'comment.deleted',
      programId,
      requestId,
      data: { commentId },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    // No notification for comment deletion
  }).catch(() => {});
}
