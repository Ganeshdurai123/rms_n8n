import { Request, IRequestDocument } from './request.model.js';
import { canUserTransition } from './stateMachine.js';
import { createAuditEntry } from '../audit/audit.utils.js';
import { getProgramById, checkProgramTimeframe } from '../program/program.service.js';
import { ProgramMember } from '../user/programMember.model.js';
import { User } from '../auth/auth.model.js';
import { AppError, NotFoundError, ValidationError, ForbiddenError } from '../../shared/errors.js';
import { cacheGet, cacheSet, cacheInvalidate, CACHE_TTL_CONFIG, CACHE_TTL_LIST } from '../../shared/cache.js';
import { emitToProgram } from '../../config/socket.js';
import { enqueueWebhookEvent } from '../webhook/webhook.service.js';
import { createNotification } from '../notification/notification.service.js';
import type { SocketEventPayload } from '../../shared/socketEvents.js';
import type { IFieldDefinition, IProgramDocument } from '../program/program.model.js';
import type { Role } from '../../shared/types.js';
import { handleChainProgression } from '../chain/chain.service.js';
import type { CreateRequestInput, UpdateRequestInput, ListRequestsQuery } from './request.schema.js';

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
 * Validate dynamic field values against a program's field definitions.
 * Enforces: required fields, type correctness, dropdown options, no extra fields.
 */
function validateFields(
  fields: Record<string, unknown> | undefined,
  fieldDefinitions: IFieldDefinition[],
): void {
  const fieldMap = new Map(fieldDefinitions.map((fd) => [fd.key, fd]));
  const providedFields = fields ?? {};

  // Check for extra fields not defined in program
  for (const key of Object.keys(providedFields)) {
    if (!fieldMap.has(key)) {
      throw new ValidationError(`Unknown field "${key}" is not defined in the program`);
    }
  }

  // Validate each field definition
  for (const def of fieldDefinitions) {
    const value = providedFields[def.key];
    const isEmpty = value === undefined || value === null || value === '';

    // Required check
    if (def.required && isEmpty) {
      throw new ValidationError(`Field "${def.label}" (${def.key}) is required`);
    }

    // Skip type validation if empty and not required
    if (isEmpty) continue;

    // Type-specific validation
    switch (def.type) {
      case 'text':
        if (typeof value !== 'string') {
          throw new ValidationError(`Field "${def.label}" (${def.key}) must be a string`);
        }
        break;

      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) {
          throw new ValidationError(`Field "${def.label}" (${def.key}) must be a number`);
        }
        break;

      case 'checkbox':
        if (typeof value !== 'boolean') {
          throw new ValidationError(`Field "${def.label}" (${def.key}) must be a boolean`);
        }
        break;

      case 'date':
        if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) {
          throw new ValidationError(`Field "${def.label}" (${def.key}) must be a valid date`);
        }
        break;

      case 'dropdown':
        if (typeof value !== 'string') {
          throw new ValidationError(`Field "${def.label}" (${def.key}) must be a string`);
        }
        if (def.options && !def.options.includes(value)) {
          throw new ValidationError(
            `Field "${def.label}" (${def.key}) must be one of: ${def.options.join(', ')}`,
          );
        }
        break;

      case 'checklist':
        if (!Array.isArray(value)) {
          throw new ValidationError(`Field "${def.label}" (${def.key}) must be an array of checklist items`);
        }
        for (let i = 0; i < value.length; i++) {
          const item = value[i] as Record<string, unknown>;
          if (
            !item ||
            typeof item !== 'object' ||
            typeof item.label !== 'string' ||
            typeof item.checked !== 'boolean'
          ) {
            throw new ValidationError(
              `Field "${def.label}" (${def.key}) item at index ${i} must have { label: string, checked: boolean }`,
            );
          }
        }
        break;

      case 'file_upload':
        // File upload values are validated at the attachment layer
        if (typeof value !== 'string') {
          throw new ValidationError(`Field "${def.label}" (${def.key}) must be a string (file reference)`);
        }
        break;
    }
  }
}

/**
 * Compute a due date for a request based on the program's dueDateConfig.
 * If dueDateField is set and a matching date value exists in fields, use it directly.
 * Otherwise, fall back to defaultOffsetDays from now.
 * Returns undefined if due dates are not enabled on the program.
 */
function computeDueDate(program: IProgramDocument, fields?: Record<string, unknown>): Date | undefined {
  if (!program.dueDateConfig?.enabled) return undefined;

  // If dueDateField is set and a date value exists in fields, use it
  if (program.dueDateConfig.dueDateField && fields) {
    const fieldValue = fields[program.dueDateConfig.dueDateField];
    if (fieldValue && typeof fieldValue === 'string') {
      const parsed = new Date(fieldValue);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  // Fall back to defaultOffsetDays from now
  const offset = program.dueDateConfig.defaultOffsetDays ?? 30;
  return new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
}

/**
 * Compute checklist completion stats from a checklist field value.
 * Returns { total, checked, percentage } or zeroes if value is not a valid checklist array.
 */
export function computeChecklistCompletion(value: unknown): { total: number; checked: number; percentage: number } {
  if (!Array.isArray(value)) {
    return { total: 0, checked: 0, percentage: 0 };
  }

  const total = value.length;
  if (total === 0) {
    return { total: 0, checked: 0, percentage: 0 };
  }

  const checked = value.filter(
    (item: unknown) =>
      item && typeof item === 'object' && (item as Record<string, unknown>).checked === true,
  ).length;

  const percentage = Math.round((checked / total) * 100);
  return { total, checked, percentage };
}

/**
 * Check program boundary limits before allowing request creation.
 * "Active" requests = status in ['submitted', 'in_review', 'approved'] -- these are requests consuming capacity.
 * Throws AppError with clear message if any limit is exceeded.
 */
async function checkBoundaryLimits(
  program: IProgramDocument,
  programId: string,
  userId: string,
): Promise<void> {
  const activeStatuses = ['submitted', 'in_review', 'approved'];

  // Check program-wide maxActiveRequests
  if (program.settings?.maxActiveRequests !== undefined && program.settings.maxActiveRequests !== null) {
    const totalActive = await Request.countDocuments({
      programId,
      status: { $in: activeStatuses },
    });
    if (totalActive >= program.settings.maxActiveRequests) {
      throw new AppError(
        `Program has reached its maximum active request limit (${program.settings.maxActiveRequests}). Please wait for existing requests to be completed or rejected before creating new ones.`,
        400,
      );
    }
  }

  // Check per-user maxActiveRequestsPerUser
  if (program.settings?.maxActiveRequestsPerUser !== undefined && program.settings.maxActiveRequestsPerUser !== null) {
    const userActive = await Request.countDocuments({
      programId,
      createdBy: userId,
      status: { $in: activeStatuses },
    });
    if (userActive >= program.settings.maxActiveRequestsPerUser) {
      throw new AppError(
        `You have reached your per-user active request limit (${program.settings.maxActiveRequestsPerUser}) in this program. Please wait for your existing requests to be completed or rejected before creating new ones.`,
        400,
      );
    }
  }
}

/**
 * Create a new request within a program.
 * Validates program existence, timeframe, and dynamic fields against field definitions.
 * Creates audit log entry for the creation event.
 */
export async function createRequest(
  data: CreateRequestInput,
  userId: string,
  userRole: Role,
): Promise<IRequestDocument> {
  // Verify program exists
  const program = await getProgramById(data.programId);

  // Enforce submission timeframe boundaries
  await checkProgramTimeframe(data.programId);

  // Enforce boundary limits (program-wide + per-user active request caps)
  await checkBoundaryLimits(program, data.programId, userId);

  // Validate dynamic fields against program field definitions
  if (data.fields || program.fieldDefinitions.length > 0) {
    validateFields(data.fields, program.fieldDefinitions);
  }

  // Compute due date from program config
  const dueDate = computeDueDate(program, data.fields);

  // Create the request document with draft status
  const request = await Request.create({
    programId: data.programId,
    title: data.title,
    description: data.description,
    fields: data.fields ?? {},
    priority: data.priority ?? 'medium',
    status: 'draft',
    createdBy: userId,
    dueDate,
  });

  // Audit log: request created
  await createAuditEntry({
    action: 'request.created',
    entityType: 'request',
    entityId: request._id.toString(),
    requestId: request._id.toString(),
    programId: data.programId,
    performedBy: userId,
    after: request.toObject(),
  });

  // Invalidate request list cache
  await cacheInvalidate('requests:list:*');

  // Emit real-time event + webhook (fire-and-forget)
  getPerformerName(userId).then((performer) => {
    emitToProgram(data.programId, 'request:created', {
      event: 'request:created',
      programId: data.programId,
      requestId: request._id.toString(),
      data: { request: request.toObject() },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    enqueueWebhookEvent('request.created', {
      eventType: 'request.created',
      programId: data.programId,
      requestId: request._id.toString(),
      data: { request: request.toObject() },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    // No notification for request creation (creator doesn't need to notify themselves)
  }).catch(() => {});

  return request;
}

/**
 * Get a single request by ID with populated references and caching.
 * Client role users can only view their own requests.
 */
export async function getRequestById(requestId: string, userId: string, userRole: Role): Promise<IRequestDocument> {
  const cacheKey = `requests:${requestId}`;
  const cached = await cacheGet<IRequestDocument>(cacheKey);

  let result: IRequestDocument;

  if (cached) {
    result = cached;
  } else {
    const request = await Request.findById(requestId)
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .populate('programId', 'name')
      .lean();

    if (!request) {
      throw new NotFoundError('Request not found');
    }

    await cacheSet(cacheKey, request, CACHE_TTL_CONFIG);
    result = request as unknown as IRequestDocument;
  }

  // Client ownership enforcement: clients can only view their own requests
  if (userRole === 'client') {
    const createdById = (result.createdBy as unknown as { _id: { toString(): string } })._id?.toString()
      ?? (result.createdBy as unknown as string).toString();
    if (createdById !== userId) {
      throw new ForbiddenError('You can only view your own requests');
    }
  }

  return result;
}

/**
 * Get paginated, filtered, access-scoped list of requests for a program.
 * Access scoping:
 *   - admin/manager: see all requests in the program
 *   - team_member: see own requests + assigned requests
 *   - client: see only own requests
 */
export async function getRequests(
  query: ListRequestsQuery,
  programId: string,
  userId: string,
  userRole: Role,
) {
  // Cache key includes programId + userId for non-admin roles
  const cacheKey =
    userRole === 'admin' || userRole === 'manager'
      ? `requests:list:${programId}:${JSON.stringify(query)}`
      : `requests:list:${programId}:${userId}:${JSON.stringify(query)}`;

  const cached = await cacheGet<{
    requests: IRequestDocument[];
    total: number;
    page: number;
    limit: number;
  }>(cacheKey);

  if (cached) {
    return cached;
  }

  const filter: Record<string, unknown> = { programId };

  // Access scoping by role
  if (userRole === 'client') {
    filter.createdBy = userId;
  } else if (userRole === 'team_member') {
    filter.$or = [{ createdBy: userId }, { assignedTo: userId }];
  }
  // admin and manager see all requests in the program

  // Optional filters
  if (query.status) {
    filter.status = query.status;
  }
  if (query.assignedTo) {
    filter.assignedTo = query.assignedTo;
  }
  if (query.priority) {
    filter.priority = query.priority;
  }
  if (query.chainId) {
    filter.chainId = query.chainId;
  }

  // Date range filters
  if (query.createdAfter || query.createdBefore) {
    const createdAtFilter: Record<string, unknown> = {};
    if (query.createdAfter) {
      createdAtFilter.$gte = query.createdAfter;
    }
    if (query.createdBefore) {
      createdAtFilter.$lte = query.createdBefore;
    }
    filter.createdAt = createdAtFilter;
  }

  // Due date range filters
  if (query.dueAfter || query.dueBefore) {
    const dueDateFilter: Record<string, unknown> = {};
    if (query.dueAfter) {
      dueDateFilter.$gte = query.dueAfter;
    }
    if (query.dueBefore) {
      dueDateFilter.$lte = query.dueBefore;
    }
    filter.dueDate = dueDateFilter;
  }

  // Custom field filtering (dot-notation into request.fields Map)
  if (query.fields && typeof query.fields === 'object') {
    for (const [key, value] of Object.entries(query.fields)) {
      // Cast checkbox-style strings to booleans for proper Map matching
      if (value === 'true') {
        filter[`fields.${key}`] = true;
      } else if (value === 'false') {
        filter[`fields.${key}`] = false;
      } else {
        filter[`fields.${key}`] = value;
      }
    }
  }

  // Text search on title and description
  if (query.search) {
    const searchRegex = { $regex: query.search, $options: 'i' };
    if (filter.$or) {
      // Combine access-scoping $or with search $or using $and
      const accessOr = filter.$or;
      delete filter.$or;
      filter.$and = [
        { $or: accessOr as Record<string, unknown>[] },
        { $or: [{ title: searchRegex }, { description: searchRegex }] },
      ];
    } else {
      filter.$or = [{ title: searchRegex }, { description: searchRegex }];
    }
  }

  // Dynamic sort
  const sortField = query.sortBy || 'createdAt';
  const sortDirection: 1 | -1 = query.sortOrder === 'asc' ? 1 : -1;
  const sortObj: Record<string, 1 | -1> = { [sortField]: sortDirection };

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [requests, total] = await Promise.all([
    Request.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .populate('chainId', 'name')
      .skip(skip)
      .limit(limit)
      .sort(sortObj)
      .lean(),
    Request.countDocuments(filter),
  ]);

  const result = { requests, total, page, limit };

  await cacheSet(cacheKey, result, CACHE_TTL_LIST);

  return result;
}

/**
 * Update a draft request's fields and metadata.
 * Only draft requests can be edited -- submitted+ requests are immutable except through transitions.
 */
export async function updateRequest(
  requestId: string,
  data: UpdateRequestInput,
  userId: string,
  userRole: Role,
): Promise<IRequestDocument> {
  const request = await Request.findById(requestId);

  if (!request) {
    throw new NotFoundError('Request not found');
  }

  // Only draft requests can have fields edited
  if (request.status !== 'draft') {
    throw new AppError('Only draft requests can be updated', 400);
  }

  // Validate dynamic fields if provided
  if (data.fields) {
    const program = await getProgramById(request.programId.toString());
    validateFields(data.fields, program.fieldDefinitions);
  }

  // Capture before snapshot
  const before = request.toObject();

  // Build update object
  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.fields !== undefined) updateData.fields = data.fields;

  const updated = await Request.findByIdAndUpdate(requestId, updateData, {
    new: true,
    runValidators: true,
  });

  if (!updated) {
    throw new NotFoundError('Request not found');
  }

  // Audit log: request updated
  await createAuditEntry({
    action: 'request.updated',
    entityType: 'request',
    entityId: requestId,
    requestId,
    programId: request.programId.toString(),
    performedBy: userId,
    before,
    after: updated.toObject(),
  });

  // Additional audit log for field edits
  if (data.fields) {
    await createAuditEntry({
      action: 'request.field_edited',
      entityType: 'request',
      entityId: requestId,
      requestId,
      programId: request.programId.toString(),
      performedBy: userId,
      metadata: { changedFields: Object.keys(data.fields) },
    });
  }

  // Invalidate caches
  await cacheInvalidate(`requests:${requestId}`);
  await cacheInvalidate('requests:list:*');

  // Emit real-time event + webhook (fire-and-forget)
  getPerformerName(userId).then((performer) => {
    emitToProgram(request.programId.toString(), 'request:updated', {
      event: 'request:updated',
      programId: request.programId.toString(),
      requestId: requestId,
      data: { request: updated.toObject(), changedFields: Object.keys(data) },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    enqueueWebhookEvent('request.updated', {
      eventType: 'request.updated',
      programId: request.programId.toString(),
      requestId: requestId,
      data: { request: updated.toObject(), changedFields: Object.keys(data) },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    // No notification for update (only draft requests can be updated, by creator)
  }).catch(() => {});

  return updated;
}

/**
 * Transition a request to a new status.
 * Validates the transition against the state machine and role-based authorization.
 * Additional rule: only the creator can submit/resubmit their request.
 */
export async function transitionRequest(
  requestId: string,
  targetStatus: string,
  userId: string,
  userRole: Role,
): Promise<IRequestDocument> {
  const request = await Request.findById(requestId);

  if (!request) {
    throw new NotFoundError('Request not found');
  }

  const currentStatus = request.status;

  // Validate transition via state machine + role authorization
  if (!canUserTransition(currentStatus, targetStatus as any, userRole)) {
    throw new AppError(
      `Invalid status transition from "${currentStatus}" to "${targetStatus}" for role "${userRole}"`,
      400,
    );
  }

  // Additional rule: only the request creator can submit (draft->submitted) or resubmit (rejected->submitted)
  if (
    targetStatus === 'submitted' &&
    (currentStatus === 'draft' || currentStatus === 'rejected')
  ) {
    if (request.createdBy.toString() !== userId) {
      throw new ForbiddenError('Only the request creator can submit or resubmit a request');
    }
  }

  // Capture before status
  const beforeStatus = currentStatus;

  // Update request status
  const updated = await Request.findByIdAndUpdate(
    requestId,
    { status: targetStatus },
    { new: true, runValidators: true },
  );

  if (!updated) {
    throw new NotFoundError('Request not found');
  }

  // Audit log: status changed
  await createAuditEntry({
    action: 'request.status_changed',
    entityType: 'request',
    entityId: requestId,
    requestId,
    programId: request.programId.toString(),
    performedBy: userId,
    before: { status: beforeStatus },
    after: { status: targetStatus },
    metadata: { from: beforeStatus, to: targetStatus },
  });

  // Invalidate caches
  await cacheInvalidate(`requests:${requestId}`);
  await cacheInvalidate('requests:list:*');

  // Emit real-time event + webhook + notifications (fire-and-forget)
  getPerformerName(userId).then((performer) => {
    emitToProgram(request.programId.toString(), 'request:status_changed', {
      event: 'request:status_changed',
      programId: request.programId.toString(),
      requestId: requestId,
      data: { request: updated.toObject(), from: beforeStatus, to: targetStatus },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    enqueueWebhookEvent('request.status_changed', {
      eventType: 'request.status_changed',
      programId: request.programId.toString(),
      requestId: requestId,
      data: { request: updated.toObject(), from: beforeStatus, to: targetStatus },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    // Notify the request creator (if they didn't perform the transition)
    const creatorId = request.createdBy.toString();
    if (creatorId !== userId) {
      createNotification({
        userId: creatorId,
        type: 'request.status_changed',
        title: 'Request status changed',
        message: `Request "${request.title}" moved from ${beforeStatus} to ${targetStatus}`,
        programId: request.programId.toString(),
        requestId: requestId,
      });
    }
    // Notify the assignee (if different from performer)
    const assigneeId = request.assignedTo?.toString();
    if (assigneeId && assigneeId !== userId) {
      createNotification({
        userId: assigneeId,
        type: 'request.status_changed',
        title: 'Request status changed',
        message: `Request "${request.title}" moved from ${beforeStatus} to ${targetStatus}`,
        programId: request.programId.toString(),
        requestId: requestId,
      });
    }
  }).catch(() => {});

  // Chain progression: if request completed, advance the chain (fire-and-forget)
  if (targetStatus === 'completed') {
    handleChainProgression(requestId, request.programId.toString(), userId)
      .then(() => {})
      .catch(() => {});
  }

  return updated;
}

/**
 * Assign or reassign a request to a team member.
 * Validates: request is in an active state, assignee is a program member with team_member or manager role.
 */
export async function assignRequest(
  requestId: string,
  assignedToUserId: string,
  performedByUserId: string,
): Promise<IRequestDocument> {
  const request = await Request.findById(requestId);

  if (!request) {
    throw new NotFoundError('Request not found');
  }

  // Assignment only for active requests (not draft or completed)
  if (request.status === 'draft' || request.status === 'completed') {
    throw new AppError(
      `Cannot assign a request with status "${request.status}". Assignment is only allowed for active requests.`,
      400,
    );
  }

  // Verify the assignee is a member of the request's program; auto-enroll as team_member if not
  const membership = await ProgramMember.findOne({
    userId: assignedToUserId,
    programId: request.programId,
    isActive: true,
  }).lean();

  if (!membership) {
    // Auto-enroll the user as a team_member in this program
    await ProgramMember.create({
      userId: assignedToUserId,
      programId: request.programId,
      role: 'team_member',
      addedBy: performedByUserId,
      isActive: true,
    });
  } else if (!['team_member', 'manager'].includes(membership.role)) {
    throw new AppError('Assignee must have team_member or manager role in the program', 400);
  }

  // Capture before state
  const beforeAssignee = request.assignedTo?.toString() ?? null;

  // Update assignedTo
  const updated = await Request.findByIdAndUpdate(
    requestId,
    { assignedTo: assignedToUserId },
    { new: true, runValidators: true },
  );

  if (!updated) {
    throw new NotFoundError('Request not found');
  }

  // Audit log: request assigned
  await createAuditEntry({
    action: 'request.assigned',
    entityType: 'request',
    entityId: requestId,
    requestId,
    programId: request.programId.toString(),
    performedBy: performedByUserId,
    before: { assignedTo: beforeAssignee },
    after: { assignedTo: assignedToUserId },
    metadata: { assignedTo: assignedToUserId },
  });

  // Invalidate caches
  await cacheInvalidate(`requests:${requestId}`);
  await cacheInvalidate('requests:list:*');

  // Emit real-time event + webhook + notification (fire-and-forget)
  getPerformerName(performedByUserId).then((performer) => {
    emitToProgram(request.programId.toString(), 'request:assigned', {
      event: 'request:assigned',
      programId: request.programId.toString(),
      requestId: requestId,
      data: { request: updated.toObject(), assignedTo: assignedToUserId, previousAssignee: beforeAssignee },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    enqueueWebhookEvent('request.assigned', {
      eventType: 'request.assigned',
      programId: request.programId.toString(),
      requestId: requestId,
      data: { request: updated.toObject(), assignedTo: assignedToUserId, previousAssignee: beforeAssignee },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    // Notify the assignee
    if (assignedToUserId !== performedByUserId) {
      createNotification({
        userId: assignedToUserId,
        type: 'request.assigned',
        title: 'Request assigned to you',
        message: `You have been assigned to "${request.title}"`,
        programId: request.programId.toString(),
        requestId: requestId,
        metadata: { programId: request.programId.toString(), requestId: requestId },
      });
    }
  }).catch(() => {});

  return updated;
}

/**
 * Delete a draft request.
 * Only draft requests can be deleted, and only by the creator or an admin.
 * Creates audit entry, invalidates caches, and emits real-time event.
 */
export async function deleteRequest(
  requestId: string,
  userId: string,
  userRole: Role,
): Promise<IRequestDocument> {
  const request = await Request.findById(requestId);

  if (!request) {
    throw new NotFoundError('Request not found');
  }

  // Only draft requests can be deleted
  if (request.status !== 'draft') {
    throw new AppError('Only draft requests can be deleted', 400);
  }

  // Only the creator or admin can delete
  if (userRole !== 'admin' && request.createdBy.toString() !== userId) {
    throw new ForbiddenError('Only the request creator or an admin can delete a request');
  }

  // Capture before snapshot
  const before = request.toObject();
  const programId = request.programId.toString();

  // Delete the request document
  await Request.findByIdAndDelete(requestId);

  // Audit log: request deleted
  await createAuditEntry({
    action: 'request.deleted',
    entityType: 'request',
    entityId: requestId,
    requestId,
    programId,
    performedBy: userId,
    before,
  });

  // Invalidate caches
  await cacheInvalidate(`requests:${requestId}`);
  await cacheInvalidate('requests:list:*');

  // Emit real-time event + webhook (fire-and-forget)
  getPerformerName(userId).then((performer) => {
    emitToProgram(programId, 'request:deleted', {
      event: 'request:deleted',
      programId,
      requestId,
      data: { request: before },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    enqueueWebhookEvent('request.deleted', {
      eventType: 'request.deleted',
      programId,
      requestId,
      data: { request: before },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
  }).catch(() => {});

  return request;
}

/**
 * Escape a CSV field value: wrap in double quotes if it contains commas, quotes, or newlines.
 * Inner double quotes are doubled per CSV spec (RFC 4180).
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export filtered requests as CSV with dynamic field columns from program config.
 * Reuses the same filter-building logic as getRequests but without pagination.
 */
export async function exportRequestsCsv(
  query: ListRequestsQuery,
  programId: string,
  userId: string,
  userRole: Role,
): Promise<string> {
  // Get program with field definitions
  const program = await getProgramById(programId);

  // Build filter (same as getRequests)
  const filter: Record<string, unknown> = { programId };

  // Access scoping by role
  if (userRole === 'client') {
    filter.createdBy = userId;
  } else if (userRole === 'team_member') {
    filter.$or = [{ createdBy: userId }, { assignedTo: userId }];
  }

  // Optional filters
  if (query.status) {
    filter.status = query.status;
  }
  if (query.assignedTo) {
    filter.assignedTo = query.assignedTo;
  }
  if (query.priority) {
    filter.priority = query.priority;
  }

  // Date range filters
  if (query.createdAfter || query.createdBefore) {
    const createdAtFilter: Record<string, unknown> = {};
    if (query.createdAfter) {
      createdAtFilter.$gte = query.createdAfter;
    }
    if (query.createdBefore) {
      createdAtFilter.$lte = query.createdBefore;
    }
    filter.createdAt = createdAtFilter;
  }

  // Due date range filters
  if (query.dueAfter || query.dueBefore) {
    const dueDateFilter: Record<string, unknown> = {};
    if (query.dueAfter) {
      dueDateFilter.$gte = query.dueAfter;
    }
    if (query.dueBefore) {
      dueDateFilter.$lte = query.dueBefore;
    }
    filter.dueDate = dueDateFilter;
  }

  // Custom field filtering
  if (query.fields && typeof query.fields === 'object') {
    for (const [key, value] of Object.entries(query.fields)) {
      if (value === 'true') {
        filter[`fields.${key}`] = true;
      } else if (value === 'false') {
        filter[`fields.${key}`] = false;
      } else {
        filter[`fields.${key}`] = value;
      }
    }
  }

  // Text search on title and description
  if (query.search) {
    const searchRegex = { $regex: query.search, $options: 'i' };
    if (filter.$or) {
      const accessOr = filter.$or;
      delete filter.$or;
      filter.$and = [
        { $or: accessOr as Record<string, unknown>[] },
        { $or: [{ title: searchRegex }, { description: searchRegex }] },
      ];
    } else {
      filter.$or = [{ title: searchRegex }, { description: searchRegex }];
    }
  }

  // Dynamic sort (same as getRequests)
  const sortField = query.sortBy || 'createdAt';
  const sortDirection: 1 | -1 = query.sortOrder === 'asc' ? 1 : -1;
  const sortObj: Record<string, 1 | -1> = { [sortField]: sortDirection };

  // Fetch ALL matching requests (no pagination)
  const requests = await Request.find(filter)
    .populate('createdBy', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .sort(sortObj)
    .lean();

  // Build CSV
  const fieldDefs = program.fieldDefinitions || [];
  const staticHeaders = [
    'Title',
    'Description',
    'Status',
    'Priority',
    'Assigned To',
    'Created By',
    'Created At',
    'Updated At',
  ];
  const dynamicHeaders = fieldDefs.map((def) => def.label);
  const headerRow = [...staticHeaders, ...dynamicHeaders].map(escapeCsvField).join(',');

  const dataRows = requests.map((req) => {
    const assignedTo = req.assignedTo as unknown as { firstName: string; lastName: string } | null;
    const createdBy = req.createdBy as unknown as { firstName: string; lastName: string } | null;

    const staticValues = [
      req.title || '',
      req.description || '',
      req.status || '',
      req.priority || '',
      assignedTo ? `${assignedTo.firstName} ${assignedTo.lastName}` : '',
      createdBy ? `${createdBy.firstName} ${createdBy.lastName}` : '',
      req.createdAt ? new Date(req.createdAt).toISOString() : '',
      req.updatedAt ? new Date(req.updatedAt).toISOString() : '',
    ];

    // Dynamic field values from the request.fields Map
    const dynamicValues = fieldDefs.map((def) => {
      // After .lean(), Map becomes a plain object
      const fieldsObj = req.fields as unknown as Record<string, unknown> | undefined;
      const val = fieldsObj ? fieldsObj[def.key] : undefined;
      if (val === undefined || val === null) return '';
      // Format checklist fields as "X/Y (Z%)" instead of raw JSON
      if (def.type === 'checklist') {
        const completion = computeChecklistCompletion(val);
        return `${completion.checked}/${completion.total} (${completion.percentage}%)`;
      }
      return String(val);
    });

    return [...staticValues, ...dynamicValues].map(escapeCsvField).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Get compliance review data for a program: per-request checklist completion and aggregate stats.
 * Access-scoped the same way as getRequests (client sees own, team_member sees own+assigned, admin/manager sees all).
 */
export async function getComplianceReview(
  programId: string,
  userId: string,
  userRole: Role,
) {
  // Fetch program with field definitions
  const program = await getProgramById(programId);

  // Identify checklist field definitions
  const checklistFields = program.fieldDefinitions.filter((fd) => fd.type === 'checklist');

  if (checklistFields.length === 0) {
    return {
      checklistFields: [],
      requests: [],
      summary: { totalRequests: 0, averageCompletion: 0 },
    };
  }

  // Build access-scoped filter (same logic as getRequests)
  const filter: Record<string, unknown> = { programId };
  if (userRole === 'client') {
    filter.createdBy = userId;
  } else if (userRole === 'team_member') {
    filter.$or = [{ createdBy: userId }, { assignedTo: userId }];
  }
  // admin and manager see all requests in the program

  // Fetch all requests (no pagination) with lean for performance
  const requests = await Request.find(filter).lean();

  // Compute per-request checklist completions
  const requestResults = requests.map((req) => {
    const fieldsObj = req.fields as unknown as Record<string, unknown> | undefined;
    const completions: Record<string, { total: number; checked: number; percentage: number }> = {};

    let totalPercentage = 0;
    for (const fd of checklistFields) {
      const val = fieldsObj ? fieldsObj[fd.key] : undefined;
      const completion = computeChecklistCompletion(val);
      completions[fd.key] = completion;
      totalPercentage += completion.percentage;
    }

    const overallPercentage =
      checklistFields.length > 0 ? Math.round(totalPercentage / checklistFields.length) : 0;

    return {
      requestId: req._id.toString(),
      title: req.title,
      status: req.status,
      completions,
      overallPercentage,
    };
  });

  // Compute aggregate summary
  const averageCompletion =
    requestResults.length > 0
      ? Math.round(
          requestResults.reduce((sum, r) => sum + r.overallPercentage, 0) / requestResults.length,
        )
      : 0;

  return {
    checklistFields: checklistFields.map((f) => ({
      key: f.key,
      label: f.label,
      items: f.items,
    })),
    requests: requestResults,
    summary: {
      totalRequests: requestResults.length,
      averageCompletion,
    },
  };
}
