import { RequestChain, IRequestChainDocument } from './chain.model.js';
import { Request } from '../request/request.model.js';
import { createAuditEntry } from '../audit/audit.utils.js';
import { emitToProgram } from '../../config/socket.js';
import { enqueueWebhookEvent } from '../webhook/webhook.service.js';
import { createNotification } from '../notification/notification.service.js';
import { User } from '../auth/auth.model.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import type { CreateChainInput, ListChainsQuery } from './chain.schema.js';
import type { SocketEventPayload } from '../../shared/socketEvents.js';

/**
 * Look up a user's display name for socket event payloads.
 * Duplicated per service file to avoid circular imports (same pattern as request.service.ts).
 */
async function getPerformerName(userId: string): Promise<{ userId: string; name: string }> {
  const user = await User.findById(userId).select('firstName lastName').lean();
  return {
    userId,
    name: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
  };
}

/**
 * Create a new request chain within a program.
 *
 * Validates:
 * - All requestIds belong to the given programId
 * - All requests are in draft status
 *
 * Side effects:
 * - Sets chainId and chainSequence on each Request document
 * - Auto-submits the first request in the chain (sequence=1) from draft to submitted
 * - Creates audit log entries
 * - Fires socket and webhook events
 */
export async function createChain(
  data: CreateChainInput,
  userId: string,
  programId: string,
): Promise<IRequestChainDocument> {
  // Sort steps by sequence to ensure consistent ordering
  const sortedSteps = [...data.steps].sort((a, b) => a.sequence - b.sequence);

  // Validate all requests exist, belong to the program, and are in draft status
  const requestIds = sortedSteps.map((s) => s.requestId);
  const requests = await Request.find({
    _id: { $in: requestIds },
    programId,
  }).lean();

  if (requests.length !== requestIds.length) {
    const foundIds = new Set(requests.map((r) => r._id.toString()));
    const missing = requestIds.filter((id) => !foundIds.has(id));
    throw new ValidationError(
      `Request(s) not found in this program: ${missing.join(', ')}`,
    );
  }

  // All requests must be in draft status
  const nonDraft = requests.filter((r) => r.status !== 'draft');
  if (nonDraft.length > 0) {
    throw new ValidationError(
      `All requests in a chain must be in draft status. Non-draft: ${nonDraft.map((r) => r._id.toString()).join(', ')}`,
    );
  }

  // Create the chain document
  const chain = await RequestChain.create({
    name: data.name,
    programId,
    steps: sortedSteps,
    status: 'active',
    createdBy: userId,
  });

  // Set chainId and chainSequence on each Request document
  await Promise.all(
    sortedSteps.map((step) =>
      Request.findByIdAndUpdate(step.requestId, {
        chainId: chain._id,
        chainSequence: step.sequence,
      }),
    ),
  );

  // Auto-submit the first request in the chain (sequence=1)
  const firstStep = sortedSteps.find((s) => s.sequence === 1) ?? sortedSteps[0];
  await Request.findByIdAndUpdate(firstStep.requestId, {
    status: 'todo',
  });

  // Audit log: chain created
  await createAuditEntry({
    action: 'chain.created',
    entityType: 'chain',
    entityId: chain._id.toString(),
    requestId: firstStep.requestId,
    programId,
    performedBy: userId,
    after: chain.toObject(),
  });

  // Audit log: first step auto-submitted
  await createAuditEntry({
    action: 'request.status_changed',
    entityType: 'request',
    entityId: firstStep.requestId,
    requestId: firstStep.requestId,
    programId,
    performedBy: userId,
    before: { status: 'draft' },
    after: { status: 'todo' },
    metadata: { from: 'draft', to: 'todo', chainId: chain._id.toString(), autoTransition: true },
  });

  // Fire real-time + webhook events (fire-and-forget)
  getPerformerName(userId).then((performer) => {
    emitToProgram(programId, 'request:status_changed', {
      event: 'request:status_changed',
      programId,
      requestId: firstStep.requestId,
      data: { from: 'draft', to: 'todo', chainId: chain._id.toString(), chainName: data.name },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    emitToProgram(programId, 'chain:step_advanced', {
      event: 'chain:step_advanced',
      programId,
      requestId: firstStep.requestId,
      data: { chainId: chain._id.toString(), chainName: data.name, step: firstStep.sequence, action: 'chain_created' },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    } as SocketEventPayload);
  }).catch(() => {});

  // Return chain with populated steps
  return getChainById(chain._id.toString());
}

/**
 * Get a single chain by ID with populated step data (request title and status).
 * Throws NotFoundError if the chain does not exist.
 */
export async function getChainById(chainId: string): Promise<IRequestChainDocument> {
  const chain = await RequestChain.findById(chainId)
    .populate('steps.requestId', 'title status')
    .populate('createdBy', 'firstName lastName')
    .lean();

  if (!chain) {
    throw new NotFoundError('Chain not found');
  }

  return chain as unknown as IRequestChainDocument;
}

/**
 * Get paginated list of chains for a program, each with populated step data.
 */
export async function getChainsByProgram(
  programId: string,
  query: ListChainsQuery,
) {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const filter = { programId };

  const [chains, total] = await Promise.all([
    RequestChain.find(filter)
      .populate('steps.requestId', 'title status')
      .populate('createdBy', 'firstName lastName')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    RequestChain.countDocuments(filter),
  ]);

  return { chains, total, page, limit };
}

/**
 * Find a chain containing a given requestId.
 * Returns chain with populated steps, or null if request is not in any chain.
 * Used by request detail to show chain context.
 */
export async function getChainByRequestId(
  requestId: string,
): Promise<IRequestChainDocument | null> {
  const chain = await RequestChain.findOne({
    'steps.requestId': requestId,
  })
    .populate('steps.requestId', 'title status')
    .lean();

  return (chain as unknown as IRequestChainDocument) ?? null;
}

/**
 * Handle chain progression when a request transitions to 'completed'.
 *
 * Logic:
 * 1. Find the chain containing the completed request
 * 2. If found, determine the next step by sequence
 * 3. If next step exists, transition that request from draft to submitted
 *    - Create audit entry
 *    - Fire socket and webhook events
 *    - Create notification for the next request's creator
 * 4. If the completed request was the last step, mark chain as completed
 *
 * Fire-and-forget pattern consistent with existing codebase.
 */
export async function handleChainProgression(
  completedRequestId: string,
  programId: string,
  userId: string,
): Promise<void> {
  const chain = await RequestChain.findOne({
    'steps.requestId': completedRequestId,
    status: 'active',
  });

  if (!chain) return;

  // Find the current step and determine next
  const sortedSteps = [...chain.steps].sort((a, b) => a.sequence - b.sequence);
  const currentStepIndex = sortedSteps.findIndex(
    (s) => s.requestId.toString() === completedRequestId,
  );

  if (currentStepIndex === -1) return;

  const isLastStep = currentStepIndex === sortedSteps.length - 1;

  if (isLastStep) {
    // Mark chain as completed
    chain.status = 'completed';
    await chain.save();
    return;
  }

  // Get the next step
  const nextStep = sortedSteps[currentStepIndex + 1];
  const nextRequestId = nextStep.requestId.toString();

  // Transition the next request from draft to submitted
  const nextRequest = await Request.findById(nextRequestId);
  if (!nextRequest || nextRequest.status !== 'draft') return;

  nextRequest.status = 'todo';
  await nextRequest.save();

  // Audit log: chain step auto-submitted
  await createAuditEntry({
    action: 'chain.step_auto_submitted',
    entityType: 'chain',
    entityId: chain._id.toString(),
    requestId: nextRequestId,
    programId,
    performedBy: userId,
    before: { status: 'draft' },
    after: { status: 'todo' },
    metadata: {
      chainId: chain._id.toString(),
      chainName: chain.name,
      step: nextStep.sequence,
      triggeredByRequest: completedRequestId,
    },
  });

  // Also create a standard request.status_changed audit entry for the auto-transitioned request
  await createAuditEntry({
    action: 'request.status_changed',
    entityType: 'request',
    entityId: nextRequestId,
    requestId: nextRequestId,
    programId,
    performedBy: userId,
    before: { status: 'draft' },
    after: { status: 'todo' },
    metadata: { from: 'draft', to: 'todo', chainId: chain._id.toString(), autoTransition: true },
  });

  // Fire real-time + webhook events (fire-and-forget)
  getPerformerName(userId).then((performer) => {
    emitToProgram(programId, 'request:status_changed', {
      event: 'request:status_changed',
      programId,
      requestId: nextRequestId,
      data: {
        from: 'draft',
        to: 'todo',
        chainId: chain._id.toString(),
        chainName: chain.name,
        autoTransition: true,
      },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });
    emitToProgram(programId, 'chain:step_advanced', {
      event: 'chain:step_advanced',
      programId,
      requestId: nextRequestId,
      data: {
        chainId: chain._id.toString(),
        chainName: chain.name,
        step: nextStep.sequence,
        previousRequestId: completedRequestId,
      },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    } as SocketEventPayload);
    enqueueWebhookEvent('request.status_changed', {
      eventType: 'request.status_changed',
      programId,
      requestId: nextRequestId,
      data: {
        from: 'draft',
        to: 'todo',
        chainId: chain._id.toString(),
        chainName: chain.name,
        autoTransition: true,
      },
      performedBy: performer,
      timestamp: new Date().toISOString(),
    });

    // Notify the next request's creator
    const creatorId = nextRequest.createdBy.toString();
    if (creatorId !== userId) {
      createNotification({
        userId: creatorId,
        type: 'request.status_changed',
        title: 'Chain step activated',
        message: `Request "${nextRequest.title}" has been auto-submitted as part of chain "${chain.name}"`,
        programId,
        requestId: nextRequestId,
      });
    }
  }).catch(() => {});
}
