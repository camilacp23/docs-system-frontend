// commentModel: the pure rules of the comments of a screen (S-35), apart from the components so they can be tested.
// COMMENT_PAGE_SIZE   page size of the thread (D-144)
// COMMENT_MAX_LENGTH  4000 characters, the contract's limit (D-122)
// lastPageOf(total)   the page that holds the newest comments (at least 1)
// isBlank(text)       true when the text has no character that is not whitespace (the server's `pattern: \S`); the text
//                     itself is always sent as typed, trimming only decides whether it has content (D-122)
// commentEtag(c)      the tag of one comment, W/"<epoch ms of updatedAt, or of createdAt if never edited>" (D-123)
// authorTag(c, id)    the tag shown next to the author, only when it is true (D-143): "Reviewer" on a review comment,
//                     "Screen author" when the author is the author of the screen; otherwise null
// participantsOf(author, comments)  the people of the discussion: the screen's author plus whoever wrote a comment, each with
//                     the tag that is true for them (D-143)
// formatCommentTime   "Oct 2 · 11:05" in the browser's local time (the year is added when it is not the current one)
import type { ScreenComment } from './commentTypes';

export const COMMENT_PAGE_SIZE = 50;
export const COMMENT_MAX_LENGTH = 4000;

export function lastPageOf(total: number): number {
  return Math.max(1, Math.ceil(total / COMMENT_PAGE_SIZE));
}

export function isBlank(text: string): boolean {
  return text.trim() === '';
}

export function commentEtag(comment: Pick<ScreenComment, 'createdAt' | 'updatedAt'>): string {
  return `W/"${Date.parse(comment.updatedAt ?? comment.createdAt)}"`;
}

export function isReviewComment(comment: Pick<ScreenComment, 'reviewDecision'>): boolean {
  return comment.reviewDecision !== null;
}

export type AuthorTag = 'Reviewer' | 'Screen author';

export function authorTag(
  comment: Pick<ScreenComment, 'author' | 'reviewDecision'>,
  screenAuthorId: number,
): AuthorTag | null {
  if (comment.reviewDecision !== null) return 'Reviewer';
  return comment.author.id === screenAuthorId ? 'Screen author' : null;
}

const pad = (value: number) => String(value).padStart(2, '0');

export function formatCommentTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
  const year = date.getFullYear() === now.getFullYear() ? '' : `, ${date.getFullYear()}`;
  return `${day}${year} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface Participant {
  id: number;
  name: string;
  tag: 'Screen author' | 'Reviewer' | null;
}

export function participantsOf(
  author: { id: number; name: string },
  comments: readonly ScreenComment[],
): Participant[] {
  const byId = new Map<number, Participant>([[author.id, { ...author, tag: 'Screen author' }]]);
  for (const comment of comments) {
    const existing = byId.get(comment.author.id);
    const reviewer = comment.reviewDecision !== null;
    if (existing === undefined) {
      byId.set(comment.author.id, { ...comment.author, tag: reviewer ? 'Reviewer' : null });
    } else if (reviewer && existing.tag === null) {
      byId.set(existing.id, { ...existing, tag: 'Reviewer' });
    }
  }
  return [...byId.values()];
}
