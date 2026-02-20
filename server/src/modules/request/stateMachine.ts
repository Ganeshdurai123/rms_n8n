import type { RequestStatus } from './request.model.js';
import type { Role } from '../../shared/types.js';

/**
 * Valid status transitions for the request lifecycle.
 *
 * Lifecycle flow:
 *   draft -> submitted -> in_review -> approved -> completed
 *                  \          \-> rejected -> submitted (resubmission)
 *                   \-> rejected
 */
export const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  draft: ['submitted'],
  submitted: ['in_review', 'rejected'],
  in_review: ['approved', 'rejected'],
  approved: ['completed'],
  rejected: ['submitted'], // Allows resubmission after rejection
  completed: [], // Terminal state
};

/**
 * Role-based transition authorization.
 * Maps each "from->to" transition key to the roles allowed to perform it.
 * All roles can submit their own drafts and resubmit after rejection.
 */
const ALL_ROLES: Role[] = ['admin', 'manager', 'team_member', 'client'];

export const TRANSITION_ROLES: Record<string, Role[]> = {
  'draft->submitted': ALL_ROLES,
  'submitted->in_review': ['admin', 'manager'],
  'submitted->rejected': ['admin', 'manager'],
  'in_review->approved': ['admin', 'manager'],
  'in_review->rejected': ['admin', 'manager'],
  'approved->completed': ['admin', 'manager'],
  'rejected->submitted': ALL_ROLES,
};

/**
 * Check whether a status transition is valid according to the lifecycle rules.
 */
export function canTransition(
  currentStatus: RequestStatus,
  targetStatus: RequestStatus,
): boolean {
  const validTargets = VALID_TRANSITIONS[currentStatus];
  return validTargets.includes(targetStatus);
}

/**
 * Check whether a user with a given role can perform a specific status transition.
 * Validates both the transition validity and role authorization.
 */
export function canUserTransition(
  currentStatus: RequestStatus,
  targetStatus: RequestStatus,
  userRole: Role,
): boolean {
  if (!canTransition(currentStatus, targetStatus)) {
    return false;
  }

  const transitionKey = `${currentStatus}->${targetStatus}`;
  const allowedRoles = TRANSITION_ROLES[transitionKey];

  if (!allowedRoles) {
    return false;
  }

  return allowedRoles.includes(userRole);
}
