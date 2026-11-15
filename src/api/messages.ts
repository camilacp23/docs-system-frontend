// messages: the user-facing text of every API error (SDD Table 59, with DUPLICATE_NAME per D-63, the two
// CONTEXT_SCREEN_MISMATCH cases per D-64, the two INVALID_ORIGIN_SCREEN cases per D-68 and the two FORBIDDEN
// cases per D-77). The server `message` is never shown.
// getErrorMessage(error, ctx?) -> string | null (null: the code is handled silently, e.g. TOKEN_EXPIRED).
//   ctx.element / ctx.type: page-provided values for the <element> and <type> placeholders.
//   ctx.action: 'delete' (default) or 'rename', for the two texts of APP_CONTEXT_PROTECTED (both have no details).
// getErrorField(error) -> { field, index } | null: the form field a business error points to (`details.field`,
//   e.g. "variableAssignments[2].screenId" -> index 2), so the page can mark the exact field or row.
// getRuleMessage(rule, label) -> the text of one validation rule, so a form can check its own fields with the
//   same words as the server errors (client checks only enforce rules the contract declares).
// getFieldErrors(error, fieldLabels?) -> one translated message per field of a VALIDATION_ERROR, by rule
//   (the server's `details.fields[].message` is ignored). fieldLabels maps a field path to the label the
//   screen shows; `items[0].name` also matches `items[].name`.
import { isApiError, type ApiError } from './ApiError';

export interface MessageContext {
  element?: string;
  type?: string;
  /** What the page was doing, for codes whose text depends on it (APP_CONTEXT_PROTECTED); default 'delete'. */
  action?: 'delete' | 'rename';
}

export interface FieldError {
  field: string;
  /** First array position in `field` ("fields[2].name" -> 2), or null when the field is not in an array. */
  index: number | null;
  rule: string;
  message: string;
}

export interface ErrorField {
  field: string;
  index: number | null;
}

const UNKNOWN_VALUE_TEXT = "This value isn't valid.";
const GENERIC_ELEMENT = 'resource';
const GENERIC_TYPE = 'item';

/** Codes that never reach the user (note of Table 59). */
const SILENT_CODES: readonly string[] = ['UNAUTHENTICATED', 'TOKEN_EXPIRED', 'INVALID_SIGNATURE'];

/** Static texts: no placeholders. */
const STATIC_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Check the highlighted fields.',
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  REFRESH_INVALID: 'Your session ended. Sign in again to continue.',
  EMAIL_TAKEN: 'A user with this email already exists.',
  PAYLOAD_TOO_LARGE:
    'This is too much text to save at once. Shorten the longest fields and try again.',
  SCOPE_MISMATCH: 'Set applies to global variables and UpdateContext to context variables.',
  CROSS_APPLICATION: 'You can only link elements of the same application.',
  LAST_ACTIVE_ADMIN: 'There must be at least one active administrator. Promote another user first.',
  CANNOT_DEACTIVATE_SELF: "You can't deactivate your own account.",
  RESERVED_ACCOUNT: "This is a system account and can't be changed.",
  APPLICATION_ARCHIVED: "This application is archived, so its documentation can't be changed.",
  REPORT_NOT_READY: 'Only ready reports can be published or downloaded.',
  INVALID_TRANSITION: 'This screen changed status meanwhile. Reload to see its current status.',
  NOT_IN_REVIEW: 'This screen is no longer in review. Reload to see its status.',
  SCREEN_IN_REVIEW:
    'This screen is in review. Edit it after the review, or withdraw it from review.',
  COMMENT_REQUIRED: 'Write a comment: it is required to return the documentation.',
  REVIEW_COMMENT_LOCKED: "Review decisions can't be edited.",
  STORY_NOT_IN_SCREEN: "That story doesn't belong to this screen. Refresh the list and pick again.",
  JIRA_UNAVAILABLE: "Jira isn't responding. The to-do wasn't created. Try again in a few minutes.",
  // Derived texts (DESIGN_REFERENCE.md section 9): the S-46 offline banner copy.
  NETWORK_ERROR: "You're offline. Changes can't be saved until the connection is back.",
};

const FORBIDDEN_ROLE_TEXT = "Your role doesn't allow this action.";
const FORBIDDEN_ORIGIN_TEXT = "This request's origin isn't allowed.";
const ORIGIN_APP_TEXT = 'Context variables are created inside a screen, not in App (OnStart).';

const INTERNAL_ERROR_TEXT = 'Something went wrong on our side. Try again in a moment.';

function warnMissing(code: string, name: string): void {
  if (import.meta.env.DEV) {
    // A programming error: the API contract (or the call site) should always provide this value.
    console.warn(`[messages] ${code}: missing "${name}" in details; using a neutral text.`);
  }
}

function str(details: ApiError['details'], key: string): string | null {
  const value = details?.[key];
  return typeof value === 'string' && value !== '' ? value : null;
}

function article(noun: string): string {
  return /^[aeiou]/i.test(noun) ? 'An' : 'A';
}

/** Value required by the code: warns in DEV and falls back to a neutral text. */
function required(error: ApiError, key: string, fallback: string): string {
  const value = str(error.details, key);
  if (value !== null) return value;
  warnMissing(error.code, key);
  return fallback;
}

function minutesText(error: ApiError): string {
  const fromDetails = error.details?.minutes;
  const minutes =
    typeof fromDetails === 'number' && fromDetails > 0
      ? Math.ceil(fromDetails)
      : error.retryAfterSeconds !== null
        ? Math.max(1, Math.ceil(error.retryAfterSeconds / 60))
        : null;
  if (minutes === null) {
    warnMissing(error.code, 'minutes');
    return 'a few minutes';
  }
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

function notFoundElement(error: ApiError, ctx: MessageContext): string {
  const reason = str(error.details, 'reason');
  if (reason === 'NOT_IMPLEMENTED' || reason === 'ROUTE_NOT_FOUND') return GENERIC_ELEMENT;
  return str(error.details, 'element') ?? ctx.element ?? GENERIC_ELEMENT;
}

function internalErrorText(requestId: string | null): string {
  return requestId ? `${INTERNAL_ERROR_TEXT} Reference: ${requestId}.` : INTERNAL_ERROR_TEXT;
}

/** Template fields in the order of SRS Table 28, with the label the screen shows. */
const TEMPLATE_FIELD_LABELS: ReadonlyArray<readonly [string, string]> = [
  ['onStart', 'OnStart'],
  ['workingProcess', 'Working process'],
  ['architecture', 'Architecture'],
  ['dataModel', 'Data model'],
  ['requirements', 'Requirements'],
  ['knownIssues', 'Known issues'],
  ['risks', 'Risks'],
];

/** "Known issues, Risks": readable labels, always in template order (a name this client does not know goes last). */
function templateFieldLabels(fields: unknown): string {
  if (!Array.isArray(fields)) return '';
  const names = fields.filter((f): f is string => typeof f === 'string');
  const rank = (name: string) => {
    const at = TEMPLATE_FIELD_LABELS.findIndex(([key]) => key === name);
    return at === -1 ? TEMPLATE_FIELD_LABELS.length : at;
  };
  return [...names]
    .sort((a, b) => rank(a) - rank(b))
    .map((name) => TEMPLATE_FIELD_LABELS.find(([key]) => key === name)?.[1] ?? name)
    .join(', ');
}

function keyList(value: unknown): string {
  return Array.isArray(value)
    ? value.filter((k): k is string => typeof k === 'string' && k !== '').join(', ')
    : '';
}

/** The four texts of JIRA_PARTIAL_FAILURE (contract 0.3.5), told apart by `details`, never by the server text. */
function jiraPartialFailureText(error: ApiError): string {
  const reason = str(error.details, 'reason');
  if (reason === 'SCREEN_DELETED' || reason === 'SAVE_FAILED') {
    const keys = keyList(error.details?.unsaved);
    if (keys === '') warnMissing(error.code, 'unsaved');
    return reason === 'SCREEN_DELETED'
      ? `The screen was deleted while the tickets were being created. These Jira issues weren't saved here${keys === '' ? '' : `: ${keys}`}. Delete them in Jira if you don't need them.`
      : `These Jira issues were created but couldn't be saved here${keys === '' ? '' : `: ${keys}`}. Delete them in Jira, then try again.`;
  }
  const key = str(error.details, 'key');
  if (key === null) {
    warnMissing(error.code, 'key');
    return "The story was created, but the to-do wasn't. Try again to add it to that story.";
  }
  // Only the epic exists when the details carry no storyId (the retry reuses the epic).
  return typeof error.details?.storyId === 'number'
    ? `The story ${key} was created, but the to-do wasn't. Try again to add it to that story.`
    : `The epic ${key} was created, but the story and the to-do weren't. Try again to add them to that epic.`;
}

/** The text for a code with placeholders, filled from `details` (or from the page context). */
function dynamicMessage(error: ApiError, ctx: MessageContext): string | undefined {
  switch (error.code) {
    case 'NOT_FOUND':
      return `This ${notFoundElement(error, ctx)} doesn't exist. It may have been deleted.`;
    case 'PRECONDITION_FAILED': {
      const element = str(error.details, 'element') ?? ctx.element ?? GENERIC_ELEMENT;
      return `Someone else saved changes to this ${element} after you opened it. Reload to see their version.`;
    }
    case 'DUPLICATE_NAME': {
      const type = str(error.details, 'type') ?? ctx.type ?? GENERIC_TYPE;
      const name = required(error, 'name', 'this item');
      const application = required(error, 'application', 'this application');
      return `${article(type)} ${type} named ${name} already exists in ${application}.`;
    }
    case 'FORBIDDEN':
      return str(error.details, 'reason') === 'ORIGIN'
        ? FORBIDDEN_ORIGIN_TEXT
        : FORBIDDEN_ROLE_TEXT;
    case 'INVALID_ORIGIN_SCREEN': {
      // D-68: the other-application case is told apart by its details, never by the server text.
      const screen = str(error.details, 'screen');
      const application = str(error.details, 'application');
      if (screen !== null && application !== null) {
        return `${screen} belongs to another application. Choose a screen of ${application}.`;
      }
      return ORIGIN_APP_TEXT;
    }
    case 'SCOPE_CONFLICT': {
      const fn = required(error, 'function', 'another function');
      return `You can't change the scope while collections assign this variable with ${fn}. Update those assignments first.`;
    }
    case 'CONTEXT_SCREEN_MISMATCH': {
      const variable = required(error, 'variable', 'this variable');
      if (error.details !== null && error.details.originScreenId === null) {
        return `${variable} has no origin screen. Set its origin screen before linking it.`;
      }
      const screen = required(error, 'screen', 'its origin screen');
      return `${variable} belongs to ${screen}. From here you can only write it with Navigate.`;
    }
    case 'APP_CONTEXT_PROTECTED':
      return ctx.action === 'rename'
        ? "The App (OnStart) screen can't be renamed."
        : "The App (OnStart) screen can't be deleted.";
    case 'TEMPLATE_INCOMPLETE': {
      const list = templateFieldLabels(error.details?.fields);
      if (list === '') {
        warnMissing(error.code, 'fields');
        return 'Complete all seven template fields to submit for review.';
      }
      return `Complete all seven template fields to submit for review. Missing: ${list}.`;
    }
    case 'JIRA_PARTIAL_FAILURE':
      return jiraPartialFailureText(error);
    case 'RATE_LIMITED':
      return `Too many attempts. Try again in ${minutesText(error)}.`;
    case 'INTERNAL_ERROR':
      return internalErrorText(error.requestId);
    default:
      return undefined;
  }
}

/** User-facing text of an API error, or null when the code is handled silently. */
export function getErrorMessage(error: ApiError, ctx: MessageContext = {}): string | null {
  if (SILENT_CODES.includes(error.code)) return null;
  const fixed = STATIC_MESSAGES[error.code];
  if (fixed !== undefined) return fixed;
  const dynamic = dynamicMessage(error, ctx);
  if (dynamic !== undefined) return dynamic;
  // UNEXPECTED_RESPONSE and any code this client does not know.
  return internalErrorText(error.requestId);
}

/** Text for anything that was thrown: ApiError through the catalog, anything else as an unexpected error. */
export function getThrownMessage(thrown: unknown, ctx: MessageContext = {}): string {
  if (isApiError(thrown))
    return getErrorMessage(thrown, ctx) ?? internalErrorText(thrown.requestId);
  return INTERNAL_ERROR_TEXT;
}

// ---------------------------------------------------------------------------------------------------------
// VALIDATION_ERROR: one message per field, translated by rule (never from the server text).
// Rules come from the Ajv keywords of the request validator (`details.fields[].rule`), the database rules of the
// backend (`unique`, `CHECK`), and the pagination / sort checks (`range`, `enum`).

type RuleText = (label: string) => string;

const RULE_MESSAGES: Record<string, RuleText> = {
  required: (label) => `${label} is required.`,
  pattern: (label) => `${label} isn't in a valid format.`,
  format: (label) => `${label} isn't in a valid format.`,
  minLength: (label) => `${label} is too short.`,
  maxLength: (label) => `${label} is too long.`,
  enum: (label) => `Choose one of the available options for ${label}.`,
  const: (label) => `Choose one of the available options for ${label}.`,
  minimum: (label) => `${label} is below the allowed range.`,
  maximum: (label) => `${label} is above the allowed range.`,
  range: (label) => `${label} is outside the allowed range.`,
  minItems: (label) => `Add at least one item to ${label}.`,
  min_items: (label) => `Add at least one item to ${label}.`,
  maxItems: (label) => `${label} has too many items.`,
  uniqueItems: (label) => `${label} has repeated values. Each one must be unique.`,
  unique: (label) => `${label} has repeated values. Each one must be unique.`,
  self: (label) => `${label} can't point to itself.`,
  singleLine: (label) => `${label} must be a single line.`,
  type: (label) => `${label} has an unexpected type of value.`,
  CHECK: (label) => `${label} doesn't meet the required conditions.`,
};

const DEFAULT_LABEL = 'This field';

function labelFor(field: string, labels: Record<string, string>): string {
  const exact = labels[field];
  if (exact !== undefined) return exact;
  const generic = labels[field.replace(/\[\d+\]/g, '[]')];
  return generic ?? DEFAULT_LABEL;
}

/** First array position of a field path: "fields[2].name" -> 2; null when there is none. */
function indexOf(field: string): number | null {
  const match = /\[(\d+)\]/.exec(field);
  return match?.[1] === undefined ? null : Number(match[1]);
}

/**
 * The form field a business error (404, 409, 422) points to, from `details.field` (D-68, D-75, D-76); null when
 * the error carries none. For a VALIDATION_ERROR use getFieldErrors.
 */
export function getErrorField(error: ApiError): ErrorField | null {
  const field = str(error.details, 'field');
  return field === null ? null : { field, index: indexOf(field) };
}

/** Text of one validation rule for a field label (the messages of getFieldErrors). */
export function getRuleMessage(rule: string, label: string = DEFAULT_LABEL): string {
  const text = RULE_MESSAGES[rule];
  return text ? text(label) : UNKNOWN_VALUE_TEXT;
}

/** Translated per-field messages of a VALIDATION_ERROR; empty for any other error. */
export function getFieldErrors(
  error: ApiError,
  fieldLabels: Record<string, string> = {},
): FieldError[] {
  if (error.code !== 'VALIDATION_ERROR') return [];
  const fields = error.details?.fields;
  if (!Array.isArray(fields)) return [];
  const result: FieldError[] = [];
  for (const entry of fields as unknown[]) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { field, rule } = entry as { field?: unknown; rule?: unknown };
    if (typeof field !== 'string') continue;
    const ruleName = typeof rule === 'string' ? rule : '';
    result.push({
      field,
      index: indexOf(field),
      rule: ruleName,
      message: getRuleMessage(ruleName, labelFor(field, fieldLabels)),
    });
  }
  return result;
}
