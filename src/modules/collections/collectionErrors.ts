// collectionErrors: puts the error of a collection write (POST or PUT) on the exact field or row it points to.
// mapCollectionError(error, rows) -> CollectionFormErrors
//   rows = submittedRows(values): the keys of the rows IN THE ORDER THEY WERE SENT. The server only knows a position
//   (`fields[3].name`); the rows may have been moved or removed since the form was opened, so the position is
//   translated with the order that was submitted, never with the current one.
//   VALIDATION_ERROR   one message per field, by rule (getFieldErrors): `unique` and the others with their position
//                      (field name, environment, assignment, derivation), `self` on derivedFrom
//   DUPLICATE_NAME     name
//   NOT_FOUND          the nested id or reference of `details.field` (fields[i].id, variableAssignments[i].id /
//                      .variableId / .screenId, derivedFrom[i]); without a position the form banner
//   CROSS_APPLICATION, SCOPE_MISMATCH, CONTEXT_SCREEN_MISMATCH   the cell or the row of `details.field`
//   anything else      the form banner with the catalog text
// The server `message` is never used: the texts come from the catalog (src/api/messages.ts).
import type { ApiError } from '../../api/ApiError';
import { getErrorField, getErrorMessage, getFieldErrors } from '../../api/messages';

import {
  FIELD_LABEL,
  type AssignmentRowErrors,
  type CollectionFormErrors,
  type FieldRowErrors,
  type SubmittedRows,
} from './collectionForm';

const FIELD_LABELS: Record<string, string> = {
  name: FIELD_LABEL.name,
  description: FIELD_LABEL.description,
  creationCondition: FIELD_LABEL.creationCondition,
  environments: 'Environments',
  'environments[].environment': 'Environment',
  'environments[].notes': 'Notes',
  fields: FIELD_LABEL.fields,
  'fields[]': 'Field',
  'fields[].id': 'Field',
  'fields[].name': FIELD_LABEL.fieldName,
  'fields[].dataType': FIELD_LABEL.fieldDataType,
  'fields[].description': FIELD_LABEL.fieldDescription,
  'fields[].position': 'Position',
  variableAssignments: FIELD_LABEL.assignments,
  'variableAssignments[]': 'Assignment',
  'variableAssignments[].id': 'Assignment',
  'variableAssignments[].variableId': FIELD_LABEL.variable,
  'variableAssignments[].screenId': FIELD_LABEL.screen,
  'variableAssignments[].assignmentFunction': FIELD_LABEL.assignmentFunction,
  'variableAssignments[].tableFunction': FIELD_LABEL.tableFunction,
  'variableAssignments[].usedIn': FIELD_LABEL.usedIn,
  derivedFrom: FIELD_LABEL.derivedFrom,
  'derivedFrom[]': FIELD_LABEL.derivedFrom,
};

const FIELD_PROPS = ['name', 'dataType', 'description'] as const;
const ASSIGNMENT_PROPS = [
  'variableId',
  'screenId',
  'assignmentFunction',
  'tableFunction',
  'usedIn',
] as const;

interface FieldPath {
  base: string;
  index: number | null;
  prop: string | null;
}

/** "variableAssignments[2].screenId" -> { base: 'variableAssignments', index: 2, prop: 'screenId' }. */
function parsePath(field: string): FieldPath | null {
  const match = /^(\w+)(?:\[(\d+)\])?(?:\.(\w+))?$/.exec(field);
  if (match?.[1] === undefined) return null;
  return {
    base: match[1],
    index: match[2] === undefined ? null : Number(match[2]),
    prop: match[3] ?? null,
  };
}

function fieldRow(errors: CollectionFormErrors, key: string): FieldRowErrors {
  errors.fieldRows ??= {};
  return (errors.fieldRows[key] ??= {});
}

function assignmentRow(errors: CollectionFormErrors, key: string): AssignmentRowErrors {
  errors.assignmentRows ??= {};
  return (errors.assignmentRows[key] ??= {});
}

/** Writes `message` where `path` points; false when the path is unknown or its position is not in the body. */
function place(
  errors: CollectionFormErrors,
  rows: SubmittedRows,
  path: FieldPath,
  message: string,
): boolean {
  const { base, index, prop } = path;
  switch (base) {
    case 'name':
    case 'description':
    case 'creationCondition':
      errors[base] ??= message;
      return true;
    case 'environments': {
      if (index === null) {
        errors.environments ??= message;
        return true;
      }
      const environment = rows.environments[index];
      if (environment === undefined) return false;
      errors.environmentRows ??= {};
      errors.environmentRows[environment] ??= message;
      return true;
    }
    case 'fields': {
      if (index === null) {
        errors.fields ??= message;
        return true;
      }
      const key = rows.fields[index];
      if (key === undefined) return false;
      const row = fieldRow(errors, key);
      const own = FIELD_PROPS.find((candidate) => candidate === prop);
      if (own !== undefined) row[own] ??= message;
      else row.row ??= message;
      return true;
    }
    case 'variableAssignments': {
      if (index === null) {
        errors.assignments ??= message;
        return true;
      }
      const key = rows.assignments[index];
      if (key === undefined) return false;
      const row = assignmentRow(errors, key);
      const own = ASSIGNMENT_PROPS.find((candidate) => candidate === prop);
      if (own !== undefined) row[own] ??= message;
      else row.row ??= message;
      return true;
    }
    case 'derivedFrom':
      errors.derivedFrom ??= message;
      return true;
    default:
      return false;
  }
}

function fromValidation(error: ApiError, rows: SubmittedRows): CollectionFormErrors {
  const errors: CollectionFormErrors = {};
  let placed = false;
  for (const fieldError of getFieldErrors(error, FIELD_LABELS)) {
    const path = parsePath(fieldError.field);
    if (path !== null && place(errors, rows, path, fieldError.message)) placed = true;
  }
  // A field this form does not show: say it for the whole form instead of losing it.
  if (!placed) errors.form = getErrorMessage(error) ?? undefined;
  return errors;
}

/** A business error (404, 422) that carries `details.field`: the text of the catalog goes on that cell or row. */
function fromBusiness(
  error: ApiError,
  rows: SubmittedRows,
  context: { element: string },
): CollectionFormErrors {
  const message = getErrorMessage(error, context) ?? undefined;
  const found = getErrorField(error);
  const path = found === null ? null : parsePath(found.field);
  const errors: CollectionFormErrors = {};
  if (message !== undefined && path !== null && place(errors, rows, path, message)) return errors;
  return { form: message };
}

export function mapCollectionError(error: ApiError, rows: SubmittedRows): CollectionFormErrors {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return fromValidation(error, rows);
    case 'DUPLICATE_NAME':
      return { name: getErrorMessage(error, { type: 'collection' }) ?? undefined };
    case 'NOT_FOUND':
    case 'CROSS_APPLICATION':
    case 'SCOPE_MISMATCH':
    case 'CONTEXT_SCREEN_MISMATCH':
      return fromBusiness(error, rows, { element: 'collection' });
    default:
      return { form: getErrorMessage(error, { element: 'collection' }) ?? undefined };
  }
}
