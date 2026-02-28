import type { RequestStatus } from './request.model.js';
import type { Role } from '../../shared/types.js';

/**
 * Valid status transitions for the request lifecycle.
 *
 * Lifecycle flow:
 *   draft -> (submit) -> todo -> (pick/start) -> in_progress -> (complete) -> completed
 */
export const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  draft: ['todo'],
  todo: ['in_progress'],
  in_progress: ['completed'],
  completed: [], // Terminal state
};

/**
 * Role-based transition authorization.
 * Maps each "from->to" transition key to the roles allowed to perform it.
 * All roles can submit their drafts.
 * Admin, manager, and team_member can pick (start) and complete requests.
 */
const ALL_ROLES: Role[] = ['admin', 'manager', 'team_member', 'client'];

export const TRANSITION_ROLES: Record<string, Role[]> = {
  'draft->todo': ALL_ROLES,
  'todo->in_progress': ['admin', 'manager', 'team_member'],
  'in_progress->completed': ['admin', 'manager', 'team_member'],
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
