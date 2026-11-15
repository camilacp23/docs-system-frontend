// applicationForm: the checks of the register / edit form (contract limits and the Jira project key pattern) and the
// body of POST / PUT /applications (an empty key or description goes as null; the key is never changed).
import { describe, expect, it } from 'vitest';

import {
  JIRA_KEY_ERROR_TEXT,
  emptyApplicationValues,
  hasErrors,
  toApplicationWrite,
  validateApplication,
  valuesOf,
} from '../../modules/applications/applicationForm';

const VALID = {
  name: 'Application D',
  platform: 'Power Apps',
  jiraProjectKey: 'APPD',
  description: 'What it does',
};

describe('validateApplication', () => {
  it('accepts a complete form, and one without key or description', () => {
    expect(hasErrors(validateApplication(VALID))).toBe(false);
    expect(hasErrors(validateApplication({ ...VALID, jiraProjectKey: '', description: '' }))).toBe(
      false,
    );
  });

  it('requires the name and the platform', () => {
    expect(validateApplication(emptyApplicationValues)).toEqual({
      name: 'Name is required.',
      platform: 'Platform is required.',
      jiraProjectKey: undefined,
      description: undefined,
    });
    expect(validateApplication({ ...VALID, name: '   ' }).name).toBe('Name is required.');
  });

  it('checks the lengths of the contract', () => {
    expect(validateApplication({ ...VALID, name: 'x'.repeat(121) }).name).toBe('Name is too long.');
    expect(validateApplication({ ...VALID, name: 'x'.repeat(120) }).name).toBeUndefined();
    expect(validateApplication({ ...VALID, platform: 'x'.repeat(61) }).platform).toBe(
      'Platform is too long.',
    );
    expect(validateApplication({ ...VALID, description: 'x'.repeat(4001) }).description).toBe(
      'Description is too long.',
    );
  });

  it.each([
    ['TECHEA', true],
    ['AB', true],
    ['A_1', true],
    ['A'.padEnd(20, 'B'), true],
    ['A'.padEnd(21, 'B'), false],
    ['A', false],
    ['app-d', false],
    ['appd', false],
    ['1ABC', false],
    ['_ABC', false],
    ['AB CD', false],
  ])('Jira project key %j is %s', (key, valid) => {
    expect(validateApplication({ ...VALID, jiraProjectKey: key }).jiraProjectKey).toBe(
      valid ? undefined : JIRA_KEY_ERROR_TEXT,
    );
  });
});

describe('toApplicationWrite', () => {
  it('trims the text and sends an empty key or description as null', () => {
    expect(
      toApplicationWrite({
        name: '  Application D ',
        platform: ' Power Apps ',
        jiraProjectKey: ' ',
        description: '  ',
      }),
    ).toEqual({
      name: 'Application D',
      platform: 'Power Apps',
      description: null,
      jiraProjectKey: null,
    });
  });

  it('sends the key as it was typed once trimmed', () => {
    expect(toApplicationWrite(VALID)).toEqual({
      name: 'Application D',
      platform: 'Power Apps',
      description: 'What it does',
      jiraProjectKey: 'APPD',
    });
  });
});

describe('valuesOf', () => {
  it('turns a null key or description into an empty field', () => {
    expect(
      valuesOf({ name: 'SAR', platform: 'Power Apps', jiraProjectKey: null, description: null }),
    ).toEqual({ name: 'SAR', platform: 'Power Apps', jiraProjectKey: '', description: '' });
  });
});
