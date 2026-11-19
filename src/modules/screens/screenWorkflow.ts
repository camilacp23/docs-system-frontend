// screenWorkflow: the workflow actions of a screen's header for a status and a role (SDD Table 61, frame S-25b).
// workflowActions(status, role) -> the actions to draw, each with its label, how it is sent and where it goes:
//   kind 'status'  PUT /screens/{id}/status with `to`   (every transition but the ones of a decision)
//   kind 'review'  POST /screens/{id}/review, decision APPROVE or RETURN (Administrator, IN_REVIEW only)
// Every action is a visible button, in the order they are drawn: the steps back first (secondary buttons) and the step
// forward last (the primary button), so the main action of a status is always the last one of the group and the one
// closest to the page actions. There is no "…" menu: what used to hide in it (Back to undocumented, Back to draft, Withdraw
// from review, Reopen) is as visible as the rest, because each status has one way back and it must be found.
// Table 61 (Admin, Dev): UNDOCUMENTED -> DRAFT, DRAFT -> UNDOCUMENTED | IN_PROGRESS, IN_PROGRESS -> DRAFT | IN_REVIEW,
// IN_REVIEW -> IN_PROGRESS (withdraw), APPROVED -> IN_PROGRESS (reopen). APPROVED is reached only by Approve, and
// Return (IN_REVIEW -> IN_PROGRESS with a comment) is the Administrator's too. A Reader has no action.
// The Developer has the Administrator's actions except Approve and Return (Table 61 and the contract). This is usability only: the API enforces the roles and the
// transitions, and its refusal is shown if the state changed meanwhile.
// workflowToast(action, name) -> the success notice, past tense with the object named (the pattern of Table 59).
import type { Role } from '../../app/router/routes';

import type { ApiDocumentationStatus } from './screenTypes';

export type WorkflowActionKey =
  | 'start-draft'
  | 'mark-in-progress'
  | 'back-to-undocumented'
  | 'back-to-draft'
  | 'submit'
  | 'withdraw'
  | 'reopen'
  | 'approve'
  | 'return';

export type WorkflowStatusTarget = Exclude<ApiDocumentationStatus, 'APPROVED'>;

interface ActionBase {
  key: WorkflowActionKey;
  label: string;
  /** The primary (gradient) button of the header: the step forward of the status. */
  primary: boolean;
}

export type WorkflowAction =
  | (ActionBase & { kind: 'status'; to: WorkflowStatusTarget })
  | (ActionBase & { kind: 'review'; decision: 'APPROVE' | 'RETURN' });

function status(
  key: WorkflowActionKey,
  label: string,
  to: WorkflowStatusTarget,
  primary: boolean,
): WorkflowAction {
  return { key, label, kind: 'status', to, primary };
}

function review(
  key: 'approve' | 'return',
  label: string,
  decision: 'APPROVE' | 'RETURN',
): WorkflowAction {
  return { key, label, kind: 'review', decision, primary: decision === 'APPROVE' };
}

export function workflowActions(
  documentationStatus: ApiDocumentationStatus,
  role: Role | null | undefined,
): WorkflowAction[] {
  if (role !== 'ADMINISTRATOR' && role !== 'DEVELOPER') return [];
  const isAdmin = role === 'ADMINISTRATOR';
  switch (documentationStatus) {
    case 'UNDOCUMENTED':
      return [status('start-draft', 'Start draft', 'DRAFT', true)];
    case 'DRAFT':
      return [
        status('back-to-undocumented', 'Back to undocumented', 'UNDOCUMENTED', false),
        status('mark-in-progress', 'Mark in progress', 'IN_PROGRESS', true),
      ];
    case 'IN_PROGRESS':
      return [
        status('back-to-draft', 'Back to draft', 'DRAFT', false),
        status('submit', 'Submit for review', 'IN_REVIEW', true),
      ];
    case 'IN_REVIEW':
      return isAdmin
        ? [
            status('withdraw', 'Withdraw from review', 'IN_PROGRESS', false),
            review('return', 'Return', 'RETURN'),
            review('approve', 'Approve', 'APPROVE'),
          ]
        : [status('withdraw', 'Withdraw from review', 'IN_PROGRESS', true)];
    case 'APPROVED':
      return [status('reopen', 'Reopen', 'IN_PROGRESS', false)];
    default:
      // A status this version does not know (or a screen without one): no action, never a crash.
      return [];
  }
}

export function workflowToast(key: WorkflowActionKey, name: string): string {
  switch (key) {
    case 'start-draft':
    case 'back-to-draft':
      return `${name} is now Draft.`;
    case 'mark-in-progress':
      return `${name} is now In progress.`;
    case 'back-to-undocumented':
      return `${name} is now Undocumented.`;
    case 'submit':
      return `${name} submitted for review.`;
    case 'withdraw':
      return `${name} withdrawn from review.`;
    case 'reopen':
      return `${name} reopened. Its status is now In progress.`;
    case 'approve':
      return `${name} approved.`;
    case 'return':
      return `${name} returned to In progress.`;
  }
}
