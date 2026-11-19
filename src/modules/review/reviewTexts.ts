// reviewTexts: the fixed texts of the review queue (frame S-36) and the ones derived from it (DESIGN_REFERENCE §9).
export const REVIEW_TITLE = 'Review';
export const WRITE_REASON_ID = 'review-write-reason';
export const WAITING_TITLE = 'Waiting';
export const QUEUE_LABEL = 'Screens waiting for review';
export const LOAD_MORE_LABEL = 'Load more';
export const EMPTY_QUEUE_TITLE = 'Nothing is waiting for review';
export const EMPTY_QUEUE_TEXT = 'Screens submitted for review will appear here, oldest first.';
export const WHAT_TO_CHECK = 'What to check';
export const TEMPLATE_FIELDS_TITLE = 'Template fields';
export const LAST_COMMENT_TITLE = 'Last comment';
export const NO_COMMENTS_TEXT = 'No comments yet.';
export const OPEN_SCREEN_LABEL = 'Open screen';
export const RETURN_FOR_CHANGES_LABEL = 'Return for changes';
export const APPROVE_LABEL = 'Approve';
export const RETURN_NOTE = 'Returning requires a comment for the author.';
export const READ_ONLY_NOTE = 'Only an Administrator can approve or return a screen.';

/** "3 screens waiting for a decision · oldest first". */
export function queueSubtitle(total: number): string {
  return `${total} ${total === 1 ? 'screen' : 'screens'} waiting for a decision · oldest first`;
}

/** "Author: Ana Mora · In review since 2 days ago" (the author of the screen is not necessarily who sent it). */
export function sinceText(author: string, ago: string): string {
  return `Author: ${author} · In review since ${ago}`;
}
