// commentTexts: the fixed texts of the comments tab (frame S-35) and the ones derived from it (DESIGN_REFERENCE §9).
import { ApiError } from '../../api/ApiError';
import { getErrorMessage } from '../../api/messages';

export const COMMENTS_TAB_LABEL = 'Comments';
export const THREAD_LABEL = 'Comments of this screen';
export const COMPOSER_LABEL = 'Add a comment';
export const COMPOSER_PLACEHOLDER = 'Add a comment for this screen…';
export const COMPOSER_HINT = 'Plain text';
export const EDIT_LABEL = 'Edit your comment';
export const BLANK_COMMENT_TEXT = 'Write a comment before sending it.';
export const EMPTY_THREAD_TITLE = 'No comments yet';
export const EMPTY_THREAD_TEXT = 'Be the first to comment on this screen.';
export const LOAD_EARLIER_LABEL = 'Load earlier comments';
export const EDITED_LABEL = 'edited';
export const LOCKED_LABEL = "Can't be edited";
export const PANEL_TITLE = 'About this discussion';
export const PANEL_NOTE =
  'Everyone with access to the screen can read and comment. Only your own comments can be edited.';
export const PARTIAL_PARTICIPANTS_NOTE = 'Based on the comments loaded so far.';
export const CONFLICT_EXTRA = 'Your changes will be lost, so copy anything you need first.';
export const POSTED_NOTICE = 'Comment added.';
export const UPDATED_NOTICE = 'Comment updated.';

export const DECISION_TITLE = {
  APPROVE: 'Approved',
  RETURN: 'Returned for changes',
} as const;

/** "1 earlier comment", "12 earlier comments". */
export function earlierText(count: number): string {
  return `${count} earlier ${count === 1 ? 'comment' : 'comments'}`;
}

/** The catalog text of a code that has no placeholders (used for the reasons shown without a request). */
export function catalogText(code: string): string {
  return getErrorMessage(new ApiError({ status: 422, code })) ?? '';
}
