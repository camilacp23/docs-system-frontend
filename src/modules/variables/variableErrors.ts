// variableErrors: puts the error of a variable write (POST or PUT) on the exact field it points to.
// mapVariableError(error, submitted) -> VariableFormErrors
//   VALIDATION_ERROR              one message per field, by rule (getFieldErrors); an environment position
//                                 (environments[1].environment) marks that row, found in the submitted body
//   DUPLICATE_NAME                name
//   INVALID_ORIGIN_SCREEN         origin screen (both cases of D-68)
//   NOT_FOUND on originScreenId   origin screen
//   CONTEXT_SCREEN_MISMATCH       origin screen
//   SCOPE_CONFLICT                the form banner (the page refines it with the collections, see scopeConflictImpact)
//   anything else                 the form banner with the catalog text
// The server `message` is never used: the texts come from the catalog (src/api/messages.ts).
import type { ApiError } from '../../api/ApiError';
import { getErrorField, getErrorMessage, getFieldErrors } from '../../api/messages';

import { FIELD_LABEL, type VariableFormErrors } from './variableForm';
import type { VariableDependencies, VariableWrite } from './variableTypes';

const FIELD_LABELS: Record<string, string> = {
  name: FIELD_LABEL.name,
  dataType: FIELD_LABEL.dataType,
  scope: FIELD_LABEL.scope,
  originScreenId: FIELD_LABEL.originScreenId,
  originUsedIn: FIELD_LABEL.originUsedIn,
  description: FIELD_LABEL.description,
  environments: FIELD_LABEL.environments,
  'environments[].environment': 'Environment',
  'environments[].notes': FIELD_LABEL.notes,
};

type SimpleField =
  'name' | 'dataType' | 'scope' | 'originScreenId' | 'originUsedIn' | 'description';
const SIMPLE_FIELDS: readonly string[] = [
  'name',
  'dataType',
  'scope',
  'originScreenId',
  'originUsedIn',
  'description',
];

function isSimpleField(field: string): field is SimpleField {
  return SIMPLE_FIELDS.includes(field);
}

function fromValidation(error: ApiError, submitted: VariableWrite): VariableFormErrors {
  const errors: VariableFormErrors = {};
  for (const fieldError of getFieldErrors(error, FIELD_LABELS)) {
    const base = fieldError.field.replace(/\[\d+\].*$/, '');
    if (isSimpleField(base)) {
      errors[base] ??= fieldError.message;
    } else if (base === 'environments' && fieldError.index === null) {
      errors.environments ??= fieldError.message;
    } else if (base === 'environments') {
      const environment = submitted.environments[fieldError.index ?? -1]?.environment;
      if (environment !== undefined) {
        errors.environmentRows ??= {};
        errors.environmentRows[environment] ??= fieldError.message;
      }
    }
  }
  // A field this form does not show: say it for the whole form instead of losing it.
  const mapped = Object.keys(errors).length > 0;
  if (!mapped) errors.form = getErrorMessage(error) ?? undefined;
  return errors;
}

export function mapVariableError(error: ApiError, submitted: VariableWrite): VariableFormErrors {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return fromValidation(error, submitted);
    case 'DUPLICATE_NAME':
      return { name: getErrorMessage(error, { type: 'variable' }) ?? undefined };
    case 'INVALID_ORIGIN_SCREEN':
    case 'CONTEXT_SCREEN_MISMATCH':
      return { originScreenId: getErrorMessage(error) ?? undefined };
    case 'NOT_FOUND':
      if (getErrorField(error)?.field === 'originScreenId') {
        return { originScreenId: getErrorMessage(error, { element: 'screen' }) ?? undefined };
      }
      return { form: getErrorMessage(error, { element: 'variable' }) ?? undefined };
    default:
      return { form: getErrorMessage(error, { element: 'variable' }) ?? undefined };
  }
}

/** "UpdateContext" and "UPDATE_CONTEXT" are the same function: compare without case and underscores. */
function sameFunction(a: string, b: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replaceAll('_', '');
  return normalize(a) === normalize(b);
}

export interface ScopeConflictImpact {
  /** The function the server names (details.function), as it should be read. */
  functionName: string;
  /** Assignments of that function that block the scope change. */
  count: number;
  /** The collections that hold them, once each. */
  collections: Array<{ id: number; name: string }>;
}

/**
 * What blocks a scope change, computed from a FRESH GET /variables/{id}/dependencies (not the copy loaded when
 * the page opened) and the function named by the SCOPE_CONFLICT error. Null when the error names no function.
 */
export function scopeConflictImpact(
  error: ApiError,
  dependencies: VariableDependencies,
): ScopeConflictImpact | null {
  const named = error.details?.function;
  if (typeof named !== 'string' || named === '') return null;
  const matching = dependencies.collections.filter((assignment) =>
    sameFunction(assignment.assignmentFunction, named),
  );
  const collections = new Map<number, string>();
  for (const assignment of matching)
    collections.set(assignment.collection.id, assignment.collection.name);
  return {
    functionName: named,
    count: matching.length,
    collections: [...collections].map(([id, name]) => ({ id, name })),
  };
}

export function scopeConflictFieldText(impact: ScopeConflictImpact): string {
  const noun = impact.count === 1 ? 'assignment' : 'assignments';
  return `Scope conflicts with ${impact.count} ${impact.functionName} ${noun}.`;
}
