// fakeScreenComments: GET and POST /screens/{id}/comments and PUT /comments/{id} of the in-memory screens API, with the
// checks of the real server in its order (contract 0.3.8, D-122, D-123, D-132).
//   GET   404 (the screen) after 400 (page, pageSize); oldest first (createdAt, then id), 1-based pages.
//   POST  400 (`text`: required, minLength 1, maxLength 4000, pattern \S) -> 404 -> 422 APPLICATION_ARCHIVED. The text is
//         kept as it arrives. The 201 carries the ETag of the comment, W/"<epoch ms of createdAt>".
//   PUT   400 -> 404 -> 403 FORBIDDEN (details.reason AUTHOR_ONLY) -> 422 APPLICATION_ARCHIVED -> 412 (If-Match is optional)
//         -> 422 REVIEW_COMMENT_LOCKED. The same text, compared exactly, writes nothing (the same ETag, `updatedAt`
//         unchanged); a real edit sets `updatedAt` to a value that never goes back (D-132).
// The ETag of a comment is W/"<epoch ms of updatedAt, or of createdAt if never edited>" (D-123).
// The signed-in user of the fake is CURRENT_USER (the user renderApp signs in).
import { ApiError } from '../../api/ApiError';
import type { ScreenComment } from '../../modules/comments/commentTypes';

export const CURRENT_USER = { id: 7, name: 'Ana Mora' };
const MAX_LENGTH = 4000;

export function commentEtagOf(comment: ScreenComment): string {
  return `W/"${Date.parse(comment.updatedAt ?? comment.createdAt)}"`;
}

function validation(field: string, rule: string): ApiError {
  return new ApiError({
    status: 400,
    code: 'VALIDATION_ERROR',
    details: { fields: [{ field, rule, message: 'x' }] },
  });
}

/** 400: the body of POST and PUT by itself. */
export function checkCommentBody(body: unknown): { text: string } {
  const text = (body as { text?: unknown } | undefined)?.text;
  if (text === undefined) throw validation('text', 'required');
  if (typeof text !== 'string') throw validation('text', 'type');
  if (text.length < 1) throw validation('text', 'minLength');
  if (text.length > MAX_LENGTH) throw validation('text', 'maxLength');
  if (text.trim() === '') throw validation('text', 'pattern');
  return { text };
}

/** 400: the page and the page size of the list. */
export function checkPaging(query: Record<string, unknown>): { page: number; pageSize: number } {
  const page = (query.page as number | undefined) ?? 1;
  const pageSize = (query.pageSize as number | undefined) ?? 20;
  if (!Number.isInteger(page) || page < 1) throw validation('page', 'minimum');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw validation('pageSize', 'maximum');
  }
  return { page, pageSize };
}

export function listComments(
  comments: readonly ScreenComment[],
  screenId: number,
  paging: { page: number; pageSize: number },
) {
  const rows = comments
    .filter((comment) => comment.screenId === screenId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id);
  return {
    data: rows.slice((paging.page - 1) * paging.pageSize, paging.page * paging.pageSize),
    page: paging.page,
    pageSize: paging.pageSize,
    total: rows.length,
  };
}

export interface CommentWriteEnv {
  application: { archived: boolean };
  now: () => string;
}

function archived(env: CommentWriteEnv): void {
  if (env.application.archived) throw new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' });
}

export function createComment(
  env: CommentWriteEnv,
  id: number,
  screenId: number,
  text: string,
): ScreenComment {
  archived(env);
  return {
    id,
    screenId,
    author: { ...CURRENT_USER },
    text,
    reviewDecision: null,
    createdAt: env.now(),
    updatedAt: null,
  };
}

/** Applies PUT /comments/{id} after the 400 and 404 checks. Returns the comment to store (the same object if nothing changed). */
export function editComment(
  env: CommentWriteEnv,
  current: ScreenComment,
  text: string,
  ifMatch: string | undefined,
): ScreenComment {
  if (current.author.id !== CURRENT_USER.id) {
    throw new ApiError({ status: 403, code: 'FORBIDDEN', details: { reason: 'AUTHOR_ONLY' } });
  }
  archived(env);
  if (ifMatch !== undefined && ifMatch !== commentEtagOf(current)) {
    throw new ApiError({
      status: 412,
      code: 'PRECONDITION_FAILED',
      details: { element: 'comment', currentETag: commentEtagOf(current) },
    });
  }
  if (current.reviewDecision !== null) {
    throw new ApiError({ status: 422, code: 'REVIEW_COMMENT_LOCKED' });
  }
  if (text === current.text) return current;
  const floor = Date.parse(current.updatedAt ?? current.createdAt) + 1;
  const at = new Date(Math.max(Date.parse(env.now()), floor)).toISOString();
  return { ...current, text, updatedAt: at };
}
