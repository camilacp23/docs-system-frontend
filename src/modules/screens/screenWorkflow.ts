// screenWorkflow: the workflow actions of a screen's header for a status and a role (SDD Table 61, frame S-25b).
// workflowActions(status, role) -> the actions to draw, each with its label, how it is sent and where it goes:
//   kind 'status'  PUT /screens/{id}/status with `to`   (every transition but the ones of a decision)
//   kind 'review'  POST /screens/{id}/review, decision APPROVE or RETURN (Administrator, IN_REVIEW only)
//   slot 'button'  a button next to Edit (`beforeEdit` tells whether it goes before or after Edit, as in the frame)
//   slot 'menu'    an item of the "…" menu (the less frequent ones)
// Table 61 (Admin, Dev): UNDOCUMENTED -> DRAFT, DRAFT -> UNDOCUMENTED | IN_PROGRESS, IN_PROGRESS -> DRAFT | IN_REVIEW,
// IN_REVIEW -> IN_PROGRESS (withdraw), APPROVED -> IN_PROGRESS (reopen). APPROVED is reached only by Approve, and
// Return (IN_REVIEW -> IN_PROGRESS with a comment) is the Administrator's too. A Reader has no action.
// The Developer has the Administrator's actions except Approve and Return (Table 61 and the contract; the frames
// only draw some of them, the rest go in the menu). This is usability only: the API enforces the roles and the
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
  slot: 'button' | 'menu';
  /** Buttons only: drawn before Edit (true) or after it (false), as in S-25b. */
  beforeEdit: boolean;
  /** The primary (gradient) button of the header. */
  primary: boolean;
}

export type WorkflowAction =
  | (ActionBase & { kind: 'status'; to: WorkflowStatusTarget })
  | (ActionBase & { kind: 'review'; decision: 'APPROVE' | 'RETURN' });

function status(
  key: WorkflowActionKey,
  label: string,
  to: WorkflowStatusTarget,
  slot: 'button' | 'menu',
  extra: { beforeEdit?: boolean; primary?: boolean } = {},
): WorkflowAction {
  return {
    key,
    label,
    kind: 'status',
    to,
    slot,
    beforeEdit: extra.beforeEdit ?? true,
    primary: extra.primary ?? false,
  };
}

function review(
  key: 'approve' | 'return',
  label: string,
  decision: 'APPROVE' | 'RETURN',
): WorkflowAction {
  return {
    key,
    label,
    kind: 'review',
    decision,
    slot: 'button',
    beforeEdit: false,
    primary: decision === 'APPROVE',
  };
}

export function workflowActions(
  documentationStatus: ApiDocumentationStatus,
  role: Role | null | undefined,
): WorkflowAction[] {
  if (role !== 'ADMINISTRATOR' && role !== 'DEVELOPER') return [];
  const isAdmin = role === 'ADMINISTRATOR';
  switch (documentationStatus) {
    case 'UNDOCUMENTED':
      return [status('start-draft', 'Start draft', 'DRAFT', 'button')];
    case 'DRAFT':
      return [
        status('mark-in-progress', 'Mark in progress', 'IN_PROGRESS', 'button'),
        status('back-to-undocumented', 'Back to undocumented', 'UNDOCUMENTED', 'menu'),
      ];
    case 'IN_PROGRESS':
      return [
        status('submit', 'Submit for review', 'IN_REVIEW', 'button'),
        status('back-to-draft', 'Back to draft', 'DRAFT', 'menu'),
      ];
    case 'IN_REVIEW':
      return isAdmin
        ? [
            review('return', 'Return', 'RETURN'),
            review('approve', 'Approve', 'APPROVE'),
            status('withdraw', 'Withdraw from review', 'IN_PROGRESS', 'menu'),
          ]
        : [status('withdraw', 'Withdraw from review', 'IN_PROGRESS', 'button', { primary: true })];
    case 'APPROVED':
      return [status('reopen', 'Reopen', 'IN_PROGRESS', 'menu')];
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
