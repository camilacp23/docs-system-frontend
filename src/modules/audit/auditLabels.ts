// auditLabels: the words of the audit log (S-32, S-32d, S-32f): the readable name of each audited table, the action
// names, the sentence of a record ("<actor> updated screen Detalle"), the label of a field and the page an element
// opens. Types come from the contract (AuditEntry, AuditEntityType); nothing here is sent to the API.
import type { components, operations } from '../../api/schema';

import { humanKey } from './auditFormat';

export type AuditEntry = components['schemas']['AuditEntry'];
export type AuditEntityType = components['schemas']['AuditEntityType'];
export type AuditAction = AuditEntry['action'];
/** The query of GET /audit-log as the contract declares it. */
export type AuditQuery = NonNullable<operations['listAuditLog']['parameters']['query']>;

/** The audited tables, in the order of the "Element type" filter (SDD Table 39). */
export const ENTITY_TYPES: readonly AuditEntityType[] = [
  'screen',
  'variable',
  'collection',
  'collection_field',
  'component',
  'element_environment',
  'screen_variable',
  'screen_collection',
  'variable_collection',
  'dependency',
  'jira_ticket',
  'comment',
  'report',
  'application',
  'app_user',
];

export const ENTITY_TYPE_LABEL: Record<AuditEntityType, string> = {
  app_user: 'User',
  application: 'Application',
  screen: 'Screen',
  variable: 'Variable',
  collection: 'Collection',
  collection_field: 'Collection field',
  component: 'Component',
  element_environment: 'Element environment',
  screen_variable: 'Screen–variable link',
  screen_collection: 'Screen–collection link',
  variable_collection: 'Variable–collection assignment',
  dependency: 'Dependency',
  jira_ticket: 'Jira ticket',
  comment: 'Comment',
  report: 'Report',
};

/** The noun of the sentence of a record: the label in lower case, except the frame's "ticket" (S-32). */
export function entityNoun(type: AuditEntityType): string {
  return type === 'jira_ticket' ? 'ticket' : ENTITY_TYPE_LABEL[type].toLowerCase();
}

export const ACTIONS: readonly AuditAction[] = ['CREATE', 'UPDATE', 'DELETE', 'EVENT'];

/** The name of an action in the filter and in the totals of the side panel (S-32: Created, Updated, Deleted, Events). */
export const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  EVENT: 'Events',
};

const ACTION_VERB: Record<Exclude<AuditAction, 'EVENT'>, string> = {
  CREATE: 'created',
  UPDATE: 'updated',
  DELETE: 'deleted',
};

/** What an event says in the sentence, before the element: the two review events of S-32, any other by its name. */
function eventVerb(eventName: string | null | undefined): string {
  if (eventName === 'DOCUMENTATION_APPROVED') return 'approved the documentation of';
  if (eventName === 'DOCUMENTATION_RETURNED') return 'returned the documentation of';
  return `recorded ${eventName ?? 'an event'} on`;
}

/** The sentence of a record without the actor: "updated screen", "approved the documentation of". */
export function actionPhrase(
  entry: Pick<AuditEntry, 'action' | 'eventName' | 'entityType'>,
): string {
  if (entry.action === 'EVENT') {
    const verb = eventVerb(entry.eventName);
    return entry.eventName === 'DOCUMENTATION_APPROVED' ||
      entry.eventName === 'DOCUMENTATION_RETURNED'
      ? verb
      : `${verb} ${entityNoun(entry.entityType)}`;
  }
  return `${ACTION_VERB[entry.action]} ${entityNoun(entry.entityType)}`;
}

/** The label of the element, or its id when the trigger recorded none. */
export function elementLabel(entry: Pick<AuditEntry, 'entityLabel' | 'entityId'>): string {
  const label = entry.entityLabel;
  return label === null || label === undefined || label === '' ? entry.entityId : label;
}

const PAGE_OF: Partial<Record<AuditEntityType, string>> = {
  screen: '/screens',
  variable: '/variables',
  collection: '/collections',
};

/**
 * The page of an element (D-57), or null when the type has none: associative tables, dependencies, comments,
 * reports, tickets, applications (no page of their own) and users. A deleted element still has its link: the page
 * answers with its own "doesn't exist" (S-41a). Only a plain integer id makes a link.
 */
export function elementPath(entry: Pick<AuditEntry, 'entityType' | 'entityId'>): string | null {
  const base = PAGE_OF[entry.entityType];
  return base !== undefined && /^[1-9]\d*$/.test(entry.entityId)
    ? `${base}/${entry.entityId}`
    : null;
}

/** Columns whose value the API never stores and the client never draws (it only says they changed). */
export const REDACTED_FIELDS: readonly string[] = ['passwordHash'];

/** The name of a field as the timeline shows it, written as words ("dataType" -> "Data type", "passwordHash" -> "Password"). */
export function fieldLabel(key: string): string {
  return humanKey(key);
}

export function isRedacted(key: string): boolean {
  return REDACTED_FIELDS.includes(key);
}

/** The actor of a write that did not come through the API (the API sends null, S-32). */
export const OUTSIDE_APPLICATION = 'Outside the application';

/** Who did it: "You" in a Developer's own view (S-32d), the name otherwise, or the text for a null actor. */
export function actorText(entry: Pick<AuditEntry, 'actor'>, ownView: boolean): string {
  if (entry.actor === null) return OUTSIDE_APPLICATION;
  return ownView ? 'You' : entry.actor.name;
}

/** The classes of the round icon of each action: success, info, danger and violet (the colors of the totals panel). */
export const ACTION_TONE: Record<AuditAction, string> = {
  CREATE: 'bg-success-bg text-success-ink',
  UPDATE: 'bg-info-bg text-info-ink',
  DELETE: 'bg-danger-bg text-danger',
  EVENT: 'bg-jira-soft text-jira-ink',
};
