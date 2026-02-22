import { Request, IRequestDocument } from './request.model.js';
import { canUserTransition } from './stateMachine.js';
import { createAuditEntry } from '../audit/audit.utils.js';
import { getProgramById, checkProgramTimeframe } from '../program/program.service.js';
import { ProgramMember } from '../user/programMember.model.js';
import { User } from '../auth/auth.model.js';
import { AppError, NotFoundError, ValidationError, ForbiddenError } from '../../shared/errors.js';
import { cacheGet, cacheSet, cacheInvalidate, CACHE_TTL_CONFIG, CACHE_TTL_LIST } from '../../shared/cache.js';
import { emitToProgram } from '../../config/socket.js';
import type { SocketEventPayload } from '../../shared/socketEvents.js';
import type { IFieldDefinition } from '../program/program.model.js';
import type { Role } from '../../shared/types.js';
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

  // Validate dynamic fields against program field definitions
  if (data.fields || program.fieldDefinitions.length > 0) {
    validateFields(data.fields, program.fieldDefinitions);
  }

  // Create the request document with draft status
  const request = await Request.create({
    programId: data.programId,
    title: data.title,
    description: data.description,
    fields: data.fields ?? {},
    priority: data.priority ?? 'medium',
    status: 'draft',
    createdBy: userId,
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

  // Emit real-time event (fire-and-forget)
  getPerformerName(userId).then((performer) => {
    emitToProgram(data.programId, 'request:created', {
      event: 'request:created',
      programId: data.programId,
      requestId: request._id.toString(),
      data: { request: request.toObject() },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
  }).catch(() => {});

  return request;
}

/**
 * Get a single request by ID with populated references and caching.
 */
export async function getRequestById(requestId: string): Promise<IRequestDocument> {
  const cacheKey = `requests:${requestId}`;
  const cached = await cacheGet<IRequestDocument>(cacheKey);

  if (cached) {
    return cached;
  }

  const request = await Request.findById(requestId)
    .populate('createdBy', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .populate('programId', 'name')
    .lean();

  if (!request) {
    throw new NotFoundError('Request not found');
  }

  await cacheSet(cacheKey, request, CACHE_TTL_CONFIG);

  return request as unknown as IRequestDocument;
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

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [requests, total] = await Promise.all([
    Request.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
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

  // Emit real-time event (fire-and-forget)
  getPerformerName(userId).then((performer) => {
    emitToProgram(request.programId.toString(), 'request:updated', {
      event: 'request:updated',
      programId: request.programId.toString(),
      requestId: requestId,
      data: { request: updated.toObject(), changedFields: Object.keys(data) },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
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

  // Emit real-time event (fire-and-forget)
  getPerformerName(userId).then((performer) => {
    emitToProgram(request.programId.toString(), 'request:status_changed', {
      event: 'request:status_changed',
      programId: request.programId.toString(),
      requestId: requestId,
      data: { request: updated.toObject(), from: beforeStatus, to: targetStatus },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
  }).catch(() => {});

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

  // Verify the assignee is a member of the request's program with team_member or manager role
  const membership = await ProgramMember.findOne({
    userId: assignedToUserId,
    programId: request.programId,
    isActive: true,
  }).lean();

  if (!membership) {
    throw new AppError('Assignee is not a member of this program', 400);
  }

  if (!['team_member', 'manager'].includes(membership.role)) {
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

  // Emit real-time event (fire-and-forget)
  getPerformerName(performedByUserId).then((performer) => {
    emitToProgram(request.programId.toString(), 'request:assigned', {
      event: 'request:assigned',
      programId: request.programId.toString(),
      requestId: requestId,
      data: { request: updated.toObject(), assignedTo: assignedToUserId, previousAssignee: beforeAssignee },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
  }).catch(() => {});

  return updated;
}
