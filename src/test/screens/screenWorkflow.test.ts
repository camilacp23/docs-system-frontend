// screenWorkflow: the workflow actions of a status for a role (SDD Table 61, frame S-25b) and the success notices.
// The expected table is written out here by hand, not computed from the rules, so a change to the rules shows up.
import { describe, expect, it } from 'vitest';

import type { Role } from '../../app/router/routes';
import type { ApiDocumentationStatus } from '../../modules/screens/screenTypes';
import {
  workflowActions,
  workflowToast,
  type WorkflowActionKey,
} from '../../modules/screens/screenWorkflow';

// The actions in the order they are drawn: the steps back first (secondary), the step forward last (primary). There is no menu.
const NONE: string[] = [];

const MATRIX: Record<ApiDocumentationStatus, Record<Role, string[]>> = {
  UNDOCUMENTED: {
    ADMINISTRATOR: ['Start draft'],
    DEVELOPER: ['Start draft'],
    READER: NONE,
  },
  DRAFT: {
    ADMINISTRATOR: ['Back to undocumented', 'Mark in progress'],
    DEVELOPER: ['Back to undocumented', 'Mark in progress'],
    READER: NONE,
  },
  IN_PROGRESS: {
    ADMINISTRATOR: ['Back to draft', 'Submit for review'],
    DEVELOPER: ['Back to draft', 'Submit for review'],
    READER: NONE,
  },
  IN_REVIEW: {
    ADMINISTRATOR: ['Withdraw from review', 'Return', 'Approve'],
    DEVELOPER: ['Withdraw from review'],
    READER: NONE,
  },
  APPROVED: {
    ADMINISTRATOR: ['Reopen'],
    DEVELOPER: ['Reopen'],
    READER: NONE,
  },
};

const STATUSES = Object.keys(MATRIX) as ApiDocumentationStatus[];
const ROLES: Role[] = ['ADMINISTRATOR', 'DEVELOPER', 'READER'];

describe('workflowActions', () => {
  for (const status of STATUSES) {
    for (const role of ROLES) {
      it(`${status} as ${role}`, () => {
        expect(workflowActions(status, role).map((a) => a.label)).toEqual(MATRIX[status][role]);
      });
    }
  }

  it('gives a Reader and an unknown role nothing', () => {
    expect(workflowActions('DRAFT', 'READER')).toEqual([]);
    expect(workflowActions('DRAFT', null)).toEqual([]);
    expect(workflowActions('DRAFT', undefined)).toEqual([]);
  });

  it('keeps Approve and Return for the Administrator, in review, as decisions of the review', () => {
    for (const status of STATUSES) {
      for (const role of ROLES) {
        const decisions = workflowActions(status, role).filter((a) => a.kind === 'review');
        if (status === 'IN_REVIEW' && role === 'ADMINISTRATOR') {
          expect(decisions.map((a) => (a.kind === 'review' ? a.decision : ''))).toEqual([
            'RETURN',
            'APPROVE',
          ]);
        } else {
          expect(decisions).toEqual([]);
        }
      }
    }
  });

  it('never offers APPROVED through /status, and only the allowed targets of Table 61', () => {
    const allowed: Record<ApiDocumentationStatus, string[]> = {
      UNDOCUMENTED: ['DRAFT'],
      DRAFT: ['IN_PROGRESS', 'UNDOCUMENTED'],
      IN_PROGRESS: ['DRAFT', 'IN_REVIEW'],
      IN_REVIEW: ['IN_PROGRESS'],
      APPROVED: ['IN_PROGRESS'],
    };
    for (const status of STATUSES) {
      const targets = workflowActions(status, 'DEVELOPER').flatMap((a) =>
        a.kind === 'status' ? [a.to] : [],
      );
      expect([...targets].sort()).toEqual([...allowed[status]].sort());
    }
  });

  it('makes the step forward of each status the one primary button, and the last one of the group', () => {
    for (const status of STATUSES) {
      for (const role of ['ADMINISTRATOR', 'DEVELOPER'] as const) {
        const actions = workflowActions(status, role);
        const primary = actions.filter((a) => a.primary);
        // APPROVED only goes back (Reopen): nothing is forward, so nothing is primary.
        if (status === 'APPROVED') expect(primary).toEqual([]);
        // The Developer in review can only withdraw: it is the one action, so it is the primary button.
        else if (status === 'IN_REVIEW' && role === 'DEVELOPER')
          expect(primary.map((a) => a.label)).toEqual(['Withdraw from review']);
        else {
          expect(primary).toHaveLength(1);
          expect(actions.at(-1)?.primary).toBe(true);
        }
      }
    }
  });
});

describe('workflowToast', () => {
  const EXPECTED: Record<WorkflowActionKey, string> = {
    'start-draft': 'Detalle is now Draft.',
    'mark-in-progress': 'Detalle is now In progress.',
    'back-to-undocumented': 'Detalle is now Undocumented.',
    'back-to-draft': 'Detalle is now Draft.',
    submit: 'Detalle submitted for review.',
    withdraw: 'Detalle withdrawn from review.',
    reopen: 'Detalle reopened. Its status is now In progress.',
    approve: 'Detalle approved.',
    return: 'Detalle returned to In progress.',
  };

  for (const [key, text] of Object.entries(EXPECTED)) {
    it(`says "${text}" for ${key}`, () => {
      expect(workflowToast(key as WorkflowActionKey, 'Detalle')).toBe(text);
    });
  }
});
