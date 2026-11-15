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

interface Expected {
  buttons: string[];
  menu: string[];
}

const NONE: Expected = { buttons: [], menu: [] };

const MATRIX: Record<ApiDocumentationStatus, Record<Role, Expected>> = {
  UNDOCUMENTED: {
    ADMINISTRATOR: { buttons: ['Start draft'], menu: [] },
    DEVELOPER: { buttons: ['Start draft'], menu: [] },
    READER: NONE,
  },
  DRAFT: {
    ADMINISTRATOR: { buttons: ['Mark in progress'], menu: ['Back to undocumented'] },
    DEVELOPER: { buttons: ['Mark in progress'], menu: ['Back to undocumented'] },
    READER: NONE,
  },
  IN_PROGRESS: {
    ADMINISTRATOR: { buttons: ['Submit for review'], menu: ['Back to draft'] },
    DEVELOPER: { buttons: ['Submit for review'], menu: ['Back to draft'] },
    READER: NONE,
  },
  IN_REVIEW: {
    ADMINISTRATOR: { buttons: ['Return', 'Approve'], menu: ['Withdraw from review'] },
    DEVELOPER: { buttons: ['Withdraw from review'], menu: [] },
    READER: NONE,
  },
  APPROVED: {
    ADMINISTRATOR: { buttons: [], menu: ['Reopen'] },
    DEVELOPER: { buttons: [], menu: ['Reopen'] },
    READER: NONE,
  },
};

const STATUSES = Object.keys(MATRIX) as ApiDocumentationStatus[];
const ROLES: Role[] = ['ADMINISTRATOR', 'DEVELOPER', 'READER'];

describe('workflowActions', () => {
  for (const status of STATUSES) {
    for (const role of ROLES) {
      it(`${status} as ${role}`, () => {
        const actions = workflowActions(status, role);
        expect({
          buttons: actions.filter((a) => a.slot === 'button').map((a) => a.label),
          menu: actions.filter((a) => a.slot === 'menu').map((a) => a.label),
        }).toEqual(MATRIX[status][role]);
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

  it('makes withdraw the primary button of the Developer in review and Approve the Administrator’s', () => {
    const primary = (role: Role) =>
      workflowActions('IN_REVIEW', role)
        .filter((a) => a.primary)
        .map((a) => a.label);
    expect(primary('DEVELOPER')).toEqual(['Withdraw from review']);
    expect(primary('ADMINISTRATOR')).toEqual(['Approve']);
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
