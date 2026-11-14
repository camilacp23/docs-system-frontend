// applicationForm: the "Register application" / "Edit application" form (S-08): values, the checks of what the
// contract declares (name 1 to 120, platform 1 to 60, description up to 4000, Jira project key
// ^[A-Z][A-Z0-9_]{1,19}$ or empty = the department default project) and the body of POST / PUT /applications.
// The server checks everything again.
import { getRuleMessage } from '../../api/messages';
import type { components } from '../../api/schema';

export const NAME_MAX = 120;
export const PLATFORM_MAX = 60;
export const DESCRIPTION_MAX = 4000;
export const JIRA_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,19}$/;

/** The text under the Jira project key when it does not match the pattern (frame S-08). */
export const JIRA_KEY_ERROR_TEXT =
  'Use 2–20 uppercase letters, digits or _ starting with a letter, e.g. TECHEA.';

export type ApplicationWrite = components['schemas']['ApplicationWrite'];

export interface ApplicationFormValues {
  name: string;
  platform: string;
  jiraProjectKey: string;
  description: string;
}

export interface ApplicationFormErrors {
  name?: string;
  platform?: string;
  jiraProjectKey?: string;
  description?: string;
  /** What belongs to the whole form (a business refusal, an unexpected error). */
  form?: string;
}

export const FIELD_LABEL = {
  name: 'Name',
  platform: 'Platform',
  jiraProjectKey: 'Jira project key',
  description: 'Description',
} as const;

export const emptyApplicationValues: ApplicationFormValues = {
  name: '',
  platform: '',
  jiraProjectKey: '',
  description: '',
};

export function valuesOf(application: {
  name: string;
  platform: string;
  jiraProjectKey?: string | null;
  description?: string | null;
}): ApplicationFormValues {
  return {
    name: application.name,
    platform: application.platform,
    jiraProjectKey: application.jiraProjectKey ?? '',
    description: application.description ?? '',
  };
}

function required(value: string, max: number, label: string): string | undefined {
  const text = value.trim();
  if (text === '') return getRuleMessage('required', label);
  return text.length > max ? getRuleMessage('maxLength', label) : undefined;
}

export function validateApplication(values: ApplicationFormValues): ApplicationFormErrors {
  const key = values.jiraProjectKey.trim();
  return {
    name: required(values.name, NAME_MAX, FIELD_LABEL.name),
    platform: required(values.platform, PLATFORM_MAX, FIELD_LABEL.platform),
    jiraProjectKey: key === '' || JIRA_KEY_PATTERN.test(key) ? undefined : JIRA_KEY_ERROR_TEXT,
    description:
      values.description.length > DESCRIPTION_MAX
        ? getRuleMessage('maxLength', FIELD_LABEL.description)
        : undefined,
  };
}

export function hasErrors(errors: ApplicationFormErrors): boolean {
  return Object.values(errors).some((message) => message !== undefined);
}

/** The editable representation: an empty key or description is sent as null (empty key = the default project). */
export function toApplicationWrite(values: ApplicationFormValues): ApplicationWrite {
  const description = values.description.trim();
  const key = values.jiraProjectKey.trim();
  return {
    name: values.name.trim(),
    platform: values.platform.trim(),
    description: description === '' ? null : description,
    jiraProjectKey: key === '' ? null : key,
  };
}
