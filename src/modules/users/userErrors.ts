// userErrors: puts the error of a user write (POST /users, PUT /users/{id}, PUT /users/{id}/role, DELETE) where it
// belongs, by code and never by the server text (Table 59):
//   VALIDATION_ERROR   one message per field (name, email, password, role), by rule
//   EMAIL_TAKEN        the email field
//   everything else    the banner of the form: LAST_ACTIVE_ADMIN, CANNOT_DEACTIVATE_SELF, RESERVED_ACCOUNT,
//                      NOT_FOUND ("This user doesn't exist..."), and any other code with its catalog text
// mapUserError(error, labels?) -> UserFormErrors. `labels` overrides the label of a field (the edit form calls the
// password "New password").
import type { ApiError } from '../../api/ApiError';
import { getErrorMessage, getFieldErrors } from '../../api/messages';

import { FIELD_LABEL, type UserFormErrors } from './userForm';

type FieldName = 'name' | 'email' | 'role' | 'password';
const FIELDS: readonly FieldName[] = ['name', 'email', 'role', 'password'];

function isField(value: string): value is FieldName {
  return FIELDS.some((field) => field === value);
}

export function mapUserError(
  error: ApiError,
  labels: Partial<Record<FieldName, string>> = {},
): UserFormErrors {
  switch (error.code) {
    case 'VALIDATION_ERROR': {
      const errors: UserFormErrors = {};
      const fieldLabels: Record<string, string> = { ...FIELD_LABEL, ...labels };
      for (const fieldError of getFieldErrors(error, fieldLabels)) {
        if (isField(fieldError.field)) errors[fieldError.field] ??= fieldError.message;
      }
      // A field this form does not show: say it for the whole form instead of losing it.
      if (Object.keys(errors).length === 0) errors.form = getErrorMessage(error) ?? undefined;
      return errors;
    }
    case 'EMAIL_TAKEN':
      return { email: getErrorMessage(error) ?? undefined };
    default:
      return { form: getErrorMessage(error, { element: 'user' }) ?? undefined };
  }
}
