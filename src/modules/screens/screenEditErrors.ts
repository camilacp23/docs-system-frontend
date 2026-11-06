// screenEditErrors: puts the error of a screen update (PUT /screens/{id}) on the exact field or row it points to.
// mapScreenEditError(error, rows) -> ScreenEditErrors
//   rows = submittedRows(values): the keys of the rows IN THE ORDER THEY WERE SENT. The server only knows a position
//   (`components[2].uses[1].targetId`); rows may have been added or removed since the form was opened, so the position
//   is translated with the order that was submitted, never with the current one.
//   VALIDATION_ERROR        one message per field, by rule (getFieldErrors): `unique` and `self` with their position
//   NOT_FOUND               the nested id or reference of `details.field` (D-75, D-84); without a position the banner
//   CROSS_APPLICATION, CONTEXT_SCREEN_MISMATCH   the cell or the row of `details.field`
//   DUPLICATE_NAME          name
//   APP_CONTEXT_PROTECTED   name (renaming App (OnStart), D-87)
//   anything else           the form banner with the catalog text (SCREEN_IN_REVIEW, APPLICATION_ARCHIVED ...)
// The server `message` is never used: the texts come from the catalog (src/api/messages.ts).
import type { ApiError } from '../../api/ApiError';
import { getErrorField, getErrorMessage, getFieldErrors } from '../../api/messages';

import { FIELD_LABEL, type ScreenEditErrors, type SubmittedRows } from './screenEditForm';
import { TEMPLATE_FIELDS, type TemplateKey } from './templateFields';

const FIELD_LABELS: Record<string, string> = {
  name: FIELD_LABEL.name,
  miroLink: FIELD_LABEL.miroLink,
  ...Object.fromEntries(TEMPLATE_FIELDS.map((field) => [`template.${field.key}`, field.label])),
  components: FIELD_LABEL.components,
  'components[]': 'Component',
  'components[].id': 'Component',
  'components[].name': FIELD_LABEL.componentName,
  'components[].type': FIELD_LABEL.componentType,
  'components[].onSelect': FIELD_LABEL.onSelect,
  'components[].description': FIELD_LABEL.componentDescription,
  'components[].uses': FIELD_LABEL.uses,
  'components[].uses[]': 'Use',
  'components[].uses[].id': 'Use',
  'components[].uses[].targetType': FIELD_LABEL.useType,
  'components[].uses[].targetId': FIELD_LABEL.useTarget,
  'components[].uses[].description': FIELD_LABEL.useDescription,
  variableLinks: FIELD_LABEL.variableLinks,
  'variableLinks[]': 'Variable link',
  'variableLinks[].id': 'Variable link',
  'variableLinks[].variableId': FIELD_LABEL.variable,
  'variableLinks[].accessMode': FIELD_LABEL.accessMode,
  'variableLinks[].usedIn': FIELD_LABEL.usedIn,
  collectionLinks: FIELD_LABEL.collectionLinks,
  'collectionLinks[]': 'Collection link',
  'collectionLinks[].id': 'Collection link',
  'collectionLinks[].collectionId': FIELD_LABEL.collection,
  'collectionLinks[].accessMode': FIELD_LABEL.accessMode,
  'collectionLinks[].usedIn': FIELD_LABEL.usedIn,
  navigations: FIELD_LABEL.navigations,
  'navigations[]': 'Navigation',
  'navigations[].id': 'Navigation',
  'navigations[].targetScreenId': FIELD_LABEL.navigationTarget,
  'navigations[].description': FIELD_LABEL.navigationDescription,
};

interface Segment {
  name: string;
  index: number | null;
}

/** "components[2].uses[1].targetId" -> [{components, 2}, {uses, 1}, {targetId, null}]; null when it does not parse. */
function parsePath(field: string): Segment[] | null {
  const segments: Segment[] = [];
  for (const part of field.split('.')) {
    const match = /^(\w+)(?:\[(\d+)\])?$/.exec(part);
    if (match?.[1] === undefined) return null;
    segments.push({ name: match[1], index: match[2] === undefined ? null : Number(match[2]) });
  }
  return segments;
}

const COMPONENT_PROPS = ['name', 'type', 'onSelect', 'description'] as const;
const USE_PROPS = ['targetType', 'targetId', 'description'] as const;
const VARIABLE_LINK_PROPS = ['variableId', 'accessMode', 'usedIn'] as const;
const COLLECTION_LINK_PROPS = ['collectionId', 'accessMode', 'usedIn'] as const;
const NAVIGATION_PROPS = ['targetScreenId', 'description'] as const;

function templateKey(name: string): TemplateKey | undefined {
  return TEMPLATE_FIELDS.find((field) => field.key === name)?.key;
}

/** Writes `message` where `path` points; false when the path is unknown or its position is not in the body. */
function place(
  errors: ScreenEditErrors,
  rows: SubmittedRows,
  segments: Segment[],
  message: string,
): boolean {
  const [head, second, third] = segments;
  if (head === undefined) return false;
  switch (head.name) {
    case 'name':
    case 'miroLink':
      errors[head.name] ??= message;
      return true;
    case 'template': {
      const key = second === undefined ? undefined : templateKey(second.name);
      if (key === undefined) return false;
      errors.template = { ...errors.template, [key]: errors.template?.[key] ?? message };
      return true;
    }
    case 'components': {
      if (head.index === null) {
        errors.components ??= message;
        return true;
      }
      const key = rows.components[head.index];
      if (key === undefined) return false;
      errors.componentRows ??= {};
      const row = (errors.componentRows[key] ??= {});
      if (second?.name === 'uses') {
        if (second.index === null) {
          row.uses ??= message;
          return true;
        }
        const useKey = rows.uses[head.index]?.[second.index];
        if (useKey === undefined) return false;
        row.useRows ??= {};
        const use = (row.useRows[useKey] ??= {});
        const own = USE_PROPS.find((prop) => prop === third?.name);
        if (own !== undefined) use[own] ??= message;
        else use.row ??= message;
        return true;
      }
      const own = COMPONENT_PROPS.find((prop) => prop === second?.name);
      if (own !== undefined) row[own] ??= message;
      else row.row ??= message;
      return true;
    }
    case 'variableLinks': {
      if (head.index === null) {
        errors.variableLinks ??= message;
        return true;
      }
      const key = rows.variableLinks[head.index];
      if (key === undefined) return false;
      errors.variableLinkRows ??= {};
      const row = (errors.variableLinkRows[key] ??= {});
      const own = VARIABLE_LINK_PROPS.find((prop) => prop === second?.name);
      if (own !== undefined) row[own] ??= message;
      else row.row ??= message;
      return true;
    }
    case 'collectionLinks': {
      if (head.index === null) {
        errors.collectionLinks ??= message;
        return true;
      }
      const key = rows.collectionLinks[head.index];
      if (key === undefined) return false;
      errors.collectionLinkRows ??= {};
      const row = (errors.collectionLinkRows[key] ??= {});
      const own = COLLECTION_LINK_PROPS.find((prop) => prop === second?.name);
      if (own !== undefined) row[own] ??= message;
      else row.row ??= message;
      return true;
    }
    case 'navigations': {
      if (head.index === null) {
        errors.navigations ??= message;
        return true;
      }
      const key = rows.navigations[head.index];
      if (key === undefined) return false;
      errors.navigationRows ??= {};
      const row = (errors.navigationRows[key] ??= {});
      const own = NAVIGATION_PROPS.find((prop) => prop === second?.name);
      if (own !== undefined) row[own] ??= message;
      else row.row ??= message;
      return true;
    }
    default:
      return false;
  }
}

function fromValidation(error: ApiError, rows: SubmittedRows): ScreenEditErrors {
  const errors: ScreenEditErrors = {};
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
function fromBusiness(error: ApiError, rows: SubmittedRows): ScreenEditErrors {
  const message = getErrorMessage(error, { element: 'screen' }) ?? undefined;
  const found = getErrorField(error);
  const path = found === null ? null : parsePath(found.field);
  const errors: ScreenEditErrors = {};
  if (message !== undefined && path !== null && place(errors, rows, path, message)) return errors;
  return { form: message };
}

export function mapScreenEditError(error: ApiError, rows: SubmittedRows): ScreenEditErrors {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return fromValidation(error, rows);
    case 'DUPLICATE_NAME':
      return { name: getErrorMessage(error, { type: 'screen' }) ?? undefined };
    case 'APP_CONTEXT_PROTECTED':
      return { name: getErrorMessage(error, { action: 'rename' }) ?? undefined };
    case 'NOT_FOUND':
    case 'CROSS_APPLICATION':
    case 'CONTEXT_SCREEN_MISMATCH':
      return fromBusiness(error, rows);
    default:
      return { form: getErrorMessage(error, { element: 'screen' }) ?? undefined };
  }
}
