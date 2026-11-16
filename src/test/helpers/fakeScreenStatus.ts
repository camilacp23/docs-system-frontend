// fakeScreenStatus: PUT /screens/{id}/status and POST /screens/{id}/review of the in-memory screens API, with the
// checks of the real server in its order (contract 0.3.5, D-88, Table 61).
//   /status  400 -> 404 -> 422 APPLICATION_ARCHIVED -> 412 (If-Match is optional) -> 422 INVALID_TRANSITION (same status
//            included, details { from, to }) -> 422 TEMPLATE_INCOMPLETE (only IN_PROGRESS -> IN_REVIEW, details.fields in
//            template order with the contract's names)
//   /review  400 -> 404 -> 422 APPLICATION_ARCHIVED -> 422 NOT_IN_REVIEW -> 422 COMMENT_REQUIRED (a RETURN whose comment
//            has only spaces; no comment, "" or null is 400). There is no 412: the operation takes no If-Match.
// A RETURN always adds a review comment (commentCount + 1); an APPROVE adds one only when the comment has content.
// The comment is kept as it arrives; trimming only decides whether it has content (D-88).
// Both return the screen with its new status and a new version (the ETag moves).
import { ApiError } from '../../api/ApiError';
import type { Screen } from '../../modules/screens/screenTypes';
import { hasContent, TEMPLATE_FIELDS } from '../../modules/screens/templateFields';

type Status = Screen['documentationStatus'];

/** Table 61, the transitions of /status. APPROVED is reached only through /review. */
export const STATUS_TRANSITIONS: Record<Status, readonly Status[]> = {
  UNDOCUMENTED: ['DRAFT'],
  DRAFT: ['UNDOCUMENTED', 'IN_PROGRESS'],
  IN_PROGRESS: ['DRAFT', 'IN_REVIEW'],
  IN_REVIEW: ['IN_PROGRESS'],
  APPROVED: ['IN_PROGRESS'],
};

const STATUS_BODY_VALUES = ['UNDOCUMENTED', 'DRAFT', 'IN_PROGRESS', 'IN_REVIEW'];
const MAX_COMMENT_LENGTH = 4000;

export interface ScreenStatusEnv {
  application: { archived: boolean };
  etagOf: (id: number) => string;
  now: () => string;
}

function validation(field: string, rule: string): ApiError {
  return new ApiError({
    status: 400,
    code: 'VALIDATION_ERROR',
    details: { fields: [{ field, rule, message: 'x' }] },
  });
}

/** 400: what the body says by itself (before the screen is looked up). */
export function checkStatusBody(body: unknown): { status: Status } {
  const status = (body as { status?: unknown } | undefined)?.status;
  if (typeof status !== 'string') throw validation('status', 'required');
  if (!STATUS_BODY_VALUES.includes(status)) throw validation('status', 'enum');
  return { status: status as Status };
}

export type ReviewBody =
  { decision: 'APPROVE'; comment?: string | null } | { decision: 'RETURN'; comment: string };

export function checkReviewBody(body: unknown): ReviewBody {
  const value = body as { decision?: unknown; comment?: unknown } | undefined;
  if (value?.decision !== 'APPROVE' && value?.decision !== 'RETURN') {
    throw validation('decision', 'enum');
  }
  const { comment } = value;
  if (value.decision === 'RETURN') {
    if (typeof comment !== 'string' || comment.length < 1) throw validation('comment', 'minLength');
    if (comment.length > MAX_COMMENT_LENGTH) throw validation('comment', 'maxLength');
    return { decision: 'RETURN', comment };
  }
  if (comment !== undefined && comment !== null) {
    if (typeof comment !== 'string') throw validation('comment', 'type');
    if (comment.length > MAX_COMMENT_LENGTH) throw validation('comment', 'maxLength');
  }
  return { decision: 'APPROVE', comment: comment };
}

/**
 * D-101: If-Match compares only the `updatedAt` part of the screen's tag. The fake tags a screen W/"<version>" and, once a
 * comment has been written, W/"<version>-<comments written>"; the counter is not part of what an edit compares.
 */
export function sameScreenVersion(sent: string, current: string): boolean {
  const base = (tag: string) => tag.replace(/-\d+"$/, '"');
  return base(sent) === base(current);
}

function archived(env: ScreenStatusEnv): void {
  if (env.application.archived) throw new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' });
}

/** Applies PUT /status after the 400 and 404 checks. Returns the screen to store (the caller moves the version). */
export function applyStatusChange(
  env: ScreenStatusEnv,
  current: Screen,
  to: Status,
  ifMatch: string | undefined,
): Screen {
  archived(env);
  if (ifMatch !== undefined && !sameScreenVersion(ifMatch, env.etagOf(current.id))) {
    throw new ApiError({
      status: 412,
      code: 'PRECONDITION_FAILED',
      details: { element: 'screen', currentETag: env.etagOf(current.id) },
    });
  }
  const from = current.documentationStatus;
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    throw new ApiError({ status: 422, code: 'INVALID_TRANSITION', details: { from, to } });
  }
  if (from === 'IN_PROGRESS' && to === 'IN_REVIEW') {
    const fields = TEMPLATE_FIELDS.filter((field) => !hasContent(current.template[field.key])).map(
      (field) => field.key,
    );
    if (fields.length > 0) {
      throw new ApiError({ status: 422, code: 'TEMPLATE_INCOMPLETE', details: { fields } });
    }
  }
  return { ...current, documentationStatus: to, updatedAt: env.now() };
}

/** Applies POST /review after the 400 and 404 checks. */
export function applyReview(env: ScreenStatusEnv, current: Screen, body: ReviewBody): Screen {
  archived(env);
  if (current.documentationStatus !== 'IN_REVIEW') {
    throw new ApiError({ status: 422, code: 'NOT_IN_REVIEW' });
  }
  const written = typeof body.comment === 'string' && body.comment.trim() !== '';
  if (body.decision === 'RETURN' && !written) {
    throw new ApiError({ status: 422, code: 'COMMENT_REQUIRED' });
  }
  return {
    ...current,
    documentationStatus: body.decision === 'APPROVE' ? 'APPROVED' : 'IN_PROGRESS',
    commentCount: current.commentCount + (written ? 1 : 0),
    updatedAt: env.now(),
  };
}
