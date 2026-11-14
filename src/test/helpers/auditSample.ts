// auditSample: the records the audit log tests share, taken from the frames S-32 and S-32d: today is Oct 5, 2026 and
// the browser's zone America/Costa_Rica (UTC-6), so 16:21Z is 10:21 (see renderAudit.fixClock).
// ENTRIES: an update with two fields (Detalle, Sample Developer A), an approval event (Inicio, Ana Mora = the signed-in
// user, id 7), a ticket update by the Jira integration account, a variable creation, an application update with a
// null actor (database role docs_owner, yesterday) and a collection field deletion (Oct 3).
import { makeEntry } from './fakeAuditApi';

export const ENTRIES = [
  makeEntry(9020, {
    entityId: '13',
    entityLabel: 'Detalle',
    actor: { id: 3, name: 'Sample Developer A' },
    changedFields: ['workingProcess', 'knownIssues'],
    oldValue: { workingProcess: 'Old text', knownIssues: null },
    newValue: { workingProcess: 'New text', knownIssues: 'Saving twice may duplicate the Patch.' },
    createdAt: '2026-10-05T16:21:00.000Z',
  }),
  makeEntry(9021, {
    action: 'EVENT',
    eventName: 'DOCUMENTATION_APPROVED',
    entityLabel: 'Inicio',
    actor: { id: 7, name: 'Ana Mora' },
    newValue: { from: 'IN_REVIEW', to: 'APPROVED', commentId: null },
    createdAt: '2026-10-05T16:05:00.000Z',
  }),
  makeEntry(9017, {
    entityType: 'jira_ticket',
    entityId: '7',
    entityLabel: 'TECHEA-104',
    actor: { id: 99, name: 'Integración Jira' },
    changedFields: ['status', 'statusCategory'],
    oldValue: { status: 'To Do', statusCategory: 'TO_DO' },
    newValue: { status: 'In Progress', statusCategory: 'IN_PROGRESS' },
    createdAt: '2026-10-05T15:52:00.000Z',
  }),
  makeEntry(9019, {
    action: 'CREATE',
    entityType: 'variable',
    entityId: '41',
    entityLabel: 'locOrden',
    actor: { id: 4, name: 'Sample Developer B' },
    newValue: { id: 41, name: 'locOrden', scope: 'CONTEXT' },
    createdAt: '2026-10-05T15:14:00.000Z',
  }),
  makeEntry(9018, {
    entityType: 'application',
    entityId: '1',
    entityLabel: 'SAR',
    actor: null,
    dbRole: 'docs_owner',
    changedFields: ['description'],
    oldValue: { description: 'Before' },
    newValue: { description: 'After' },
    createdAt: '2026-10-04T23:02:00.000Z',
  }),
  makeEntry(9016, {
    action: 'DELETE',
    entityType: 'collection_field',
    entityId: '5',
    entityLabel: 'Fax',
    actor: { id: 7, name: 'Ana Mora' },
    oldValue: { id: 5, name: 'Fax' },
    createdAt: '2026-10-03T14:00:00.000Z',
  }),
];
