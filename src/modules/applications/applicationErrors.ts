// applicationErrors: puts the error of an application write (POST or PUT /applications) where it belongs, by code and
// never by the server text (Table 59):
//   VALIDATION_ERROR   one message per field, by rule; the Jira project key pattern says the frame text
//   DUPLICATE_NAME     the name: "An application named X already exists in Documentación técnica." (the scope
//                      comes from `details`, D-63)
//   everything else    the banner of the form with its catalog text (NOT_FOUND, FORBIDDEN, ...)
// mapApplicationError(error) -> ApplicationFormErrors.
import type { ApiError } from '../../api/ApiError';
import { getErrorMessage, getFieldErrors } from '../../api/messages';

import { FIELD_LABEL, JIRA_KEY_ERROR_TEXT, type ApplicationFormErrors } from './applicationForm';

type FieldName = 'name' | 'platform' | 'jiraProjectKey' | 'description';
const FIELDS: readonly FieldName[] = ['name', 'platform', 'jiraProjectKey', 'description'];

function isField(value: string): value is FieldName {
  return FIELDS.some((field) => field === value);
}

export function mapApplicationError(error: ApiError): ApplicationFormErrors {
  switch (error.code) {
    case 'VALIDATION_ERROR': {
      const errors: ApplicationFormErrors = {};
      for (const fieldError of getFieldErrors(error, FIELD_LABEL)) {
        if (!isField(fieldError.field)) continue;
        errors[fieldError.field] ??=
          fieldError.field === 'jiraProjectKey' && fieldError.rule === 'pattern'
            ? JIRA_KEY_ERROR_TEXT
            : fieldError.message;
      }
      // A field this form does not show: say it for the whole form instead of losing it.
      if (Object.keys(errors).length === 0) errors.form = getErrorMessage(error) ?? undefined;
      return errors;
    }
    case 'DUPLICATE_NAME':
      return { name: getErrorMessage(error, { type: 'application' }) ?? undefined };
    default:
      return { form: getErrorMessage(error, { element: 'application' }) ?? undefined };
  }
}
