// Words of the audit log: a readable name for each audited table, the sentence of a record, the page of an element
// (only screens, variables and collections have one) and the field that is never drawn.
import { describe, expect, it } from 'vitest';

import {
  ENTITY_TYPES,
  ENTITY_TYPE_LABEL,
  actionPhrase,
  elementLabel,
  elementPath,
  fieldLabel,
  isRedacted,
} from '../../modules/audit/auditLabels';

describe('entity types', () => {
  it('has a readable label for every audited table of the contract and offers each one once', () => {
    expect(new Set(ENTITY_TYPES).size).toBe(ENTITY_TYPES.length);
    expect(ENTITY_TYPES).toHaveLength(15);
    for (const type of ENTITY_TYPES) expect(ENTITY_TYPE_LABEL[type]).not.toBe(type);
  });
});

describe('the sentence of a record', () => {
  it('says created, updated and deleted with the noun of the element', () => {
    expect(actionPhrase({ action: 'CREATE', eventName: null, entityType: 'variable' })).toBe(
      'created variable',
    );
    expect(actionPhrase({ action: 'UPDATE', eventName: null, entityType: 'jira_ticket' })).toBe(
      'updated ticket',
    );
    expect(
      actionPhrase({ action: 'DELETE', eventName: null, entityType: 'collection_field' }),
    ).toBe('deleted collection field');
  });

  it('says what a review event did, and names any other event', () => {
    const approved = { action: 'EVENT', eventName: 'DOCUMENTATION_APPROVED', entityType: 'screen' };
    expect(actionPhrase(approved as Parameters<typeof actionPhrase>[0])).toBe(
      'approved the documentation of',
    );
    const other = { action: 'EVENT', eventName: 'SOMETHING_ELSE', entityType: 'report' };
    expect(actionPhrase(other as Parameters<typeof actionPhrase>[0])).toBe(
      'recorded SOMETHING_ELSE on report',
    );
  });
});

describe('the element', () => {
  it('uses the recorded label, or the id when there is none', () => {
    expect(elementLabel({ entityLabel: 'gUsuario', entityId: '41' })).toBe('gUsuario');
    expect(elementLabel({ entityLabel: null, entityId: '41' })).toBe('41');
    expect(elementLabel({ entityLabel: '', entityId: '12:DEV' })).toBe('12:DEV');
  });

  it('opens a page only for screens, variables and collections with a plain id', () => {
    expect(elementPath({ entityType: 'screen', entityId: '12' })).toBe('/screens/12');
    expect(elementPath({ entityType: 'variable', entityId: '41' })).toBe('/variables/41');
    expect(elementPath({ entityType: 'collection', entityId: '3' })).toBe('/collections/3');
    expect(elementPath({ entityType: 'application', entityId: '2' })).toBeNull();
    expect(elementPath({ entityType: 'element_environment', entityId: '12:DEV' })).toBeNull();
    expect(elementPath({ entityType: 'screen_variable', entityId: '88' })).toBeNull();
    expect(elementPath({ entityType: 'screen', entityId: '12:DEV' })).toBeNull();
  });
});

describe('fields', () => {
  it('writes the key as words, and the password as "Password"', () => {
    expect(fieldLabel('documentationStatus')).toBe('Documentation status');
    expect(fieldLabel('miro_link')).toBe('Miro link');
    expect(fieldLabel('commentId')).toBe('Comment ID');
    expect(fieldLabel('onStart')).toBe('OnStart');
    expect(fieldLabel('passwordHash')).toBe('Password');
    expect(isRedacted('passwordHash')).toBe(true);
    expect(isRedacted('name')).toBe(false);
  });
});
