// screenForm: the values of the "New screen" form (P-03), their checks and the body of POST /screens.
// Client checks only enforce what the contract declares for ScreenWrite: `name` 1 to 150 characters and `miroLink`
// up to 2048 characters starting with https:// (FR-13). Every other rule is the server's and its error is shown on
// the exact field (screenErrors.ts). The template and the four lists are sent empty: the seven template fields are
// completed in the screen detail (P-03).
import { getRuleMessage } from '../../api/messages';

import type { ScreenCreate, ScreenTemplate } from './screenTypes';

export const NAME_MAX_LENGTH = 150;
export const MIRO_LINK_MAX_LENGTH = 2048;
const MIRO_LINK_PATTERN = /^https:\/\//;

export const FIELD_LABEL = { name: 'Name', miroLink: 'Miro link' } as const;

/** The labels of the form fields by field path, for the field errors of the server. */
export const FIELD_LABELS: Record<string, string> = {
  name: FIELD_LABEL.name,
  miroLink: FIELD_LABEL.miroLink,
};

export interface ScreenFormValues {
  name: string;
  miroLink: string;
}

export interface ScreenFormErrors {
  name?: string;
  miroLink?: string;
  /** A message for the whole form (a refusal that does not belong to one field). */
  form?: string;
}

export const emptyScreenValues: ScreenFormValues = { name: '', miroLink: '' };

const EMPTY_TEMPLATE: ScreenTemplate = {
  onStart: null,
  workingProcess: null,
  architecture: null,
  dataModel: null,
  requirements: null,
  knownIssues: null,
  risks: null,
};

export function validateScreen(values: ScreenFormValues): ScreenFormErrors {
  const errors: ScreenFormErrors = {};
  const name = values.name.trim();
  if (name === '') errors.name = getRuleMessage('required', FIELD_LABEL.name);
  else if (name.length > NAME_MAX_LENGTH)
    errors.name = getRuleMessage('maxLength', FIELD_LABEL.name);
  const link = values.miroLink.trim();
  if (link !== '') {
    if (link.length > MIRO_LINK_MAX_LENGTH)
      errors.miroLink = getRuleMessage('maxLength', FIELD_LABEL.miroLink);
    else if (!MIRO_LINK_PATTERN.test(link))
      errors.miroLink = getRuleMessage('pattern', FIELD_LABEL.miroLink);
  }
  return errors;
}

export function hasErrors(errors: ScreenFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The complete POST body: name and Miro link, the template with its seven fields empty and the four lists empty. */
export function toScreenCreate(values: ScreenFormValues, applicationId: number): ScreenCreate {
  const link = values.miroLink.trim();
  return {
    applicationId,
    name: values.name.trim(),
    miroLink: link === '' ? null : link,
    template: { ...EMPTY_TEMPLATE },
    components: [],
    variableLinks: [],
    collectionLinks: [],
    navigations: [],
  };
}
