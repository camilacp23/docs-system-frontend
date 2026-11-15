// screenErrors: puts the error of a screen write (POST) on the exact field it points to.
// mapScreenError(error) -> ScreenFormErrors
//   VALIDATION_ERROR   one message per field, by rule (getFieldErrors): name, miroLink; a field the form does not
//                      have goes to the form banner
//   DUPLICATE_NAME     name, with the text of the catalog ("A screen named X already exists in <application>.")
//   anything else      the form banner with the catalog text (APPLICATION_ARCHIVED, FORBIDDEN, NOT_FOUND ...)
// The server `message` is never used: the texts come from the catalog (src/api/messages.ts).
import type { ApiError } from '../../api/ApiError';
import { getErrorField, getErrorMessage, getFieldErrors } from '../../api/messages';

import { FIELD_LABELS, type ScreenFormErrors } from './screenForm';

export function mapScreenError(error: ApiError): ScreenFormErrors {
  if (error.code === 'VALIDATION_ERROR') {
    const errors: ScreenFormErrors = {};
    for (const found of getFieldErrors(error, FIELD_LABELS)) {
      if (found.field === 'name' || found.field === 'miroLink')
        errors[found.field] ??= found.message;
      else errors.form ??= found.message;
    }
    return Object.keys(errors).length > 0 ? errors : { form: getErrorMessage(error) ?? '' };
  }
  const message = getErrorMessage(error, { element: 'screen', type: 'screen' }) ?? '';
  if (error.code === 'DUPLICATE_NAME' && getErrorField(error)?.field !== 'miroLink') {
    return { name: message };
  }
  return { form: message };
}
