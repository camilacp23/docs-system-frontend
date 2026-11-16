// commentModel: the pure rules of the comments tab: the last page, blank text, the tag of a comment (D-123), the author
// tags that are only drawn when they are true (D-143) and the time format.
import { describe, expect, it } from 'vitest';

import {
  authorTag,
  commentEtag,
  COMMENT_MAX_LENGTH,
  COMMENT_PAGE_SIZE,
  formatCommentTime,
  isBlank,
  lastPageOf,
} from '../../modules/comments/commentModel';

describe('lastPageOf', () => {
  it('is the page that holds the newest comments, at least 1', () => {
    expect(COMMENT_PAGE_SIZE).toBe(50);
    expect([0, 1, 50].map(lastPageOf)).toEqual([1, 1, 1]);
    expect([51, 100, 101, 250].map(lastPageOf)).toEqual([2, 2, 3, 5]);
  });
});

describe('isBlank', () => {
  it('is true only when no character is left after trimming (the server pattern \\S)', () => {
    expect(COMMENT_MAX_LENGTH).toBe(4000);
    expect(isBlank('')).toBe(true);
    expect(isBlank(' \n\t ')).toBe(true);
    expect(isBlank(' a ')).toBe(false);
  });
});

describe('commentEtag (D-123)', () => {
  it('uses the epoch ms of updatedAt, or of createdAt when the comment was never edited', () => {
    const created = '2026-11-12T09:00:00.000Z';
    const edited = '2026-11-12T09:20:00.000Z';
    expect(commentEtag({ createdAt: created, updatedAt: null })).toBe(`W/"${Date.parse(created)}"`);
    expect(commentEtag({ createdAt: created, updatedAt: edited })).toBe(
      `W/"${Date.parse(edited)}"`,
    );
  });
});

describe('authorTag (D-143)', () => {
  const comment = (id: number, decision: 'APPROVE' | 'RETURN' | null) => ({
    author: { id, name: 'X' },
    reviewDecision: decision,
  });

  it('says "Reviewer" on a review comment, "Screen author" for the author of the screen, and nothing else', () => {
    expect(authorTag(comment(2, null), 2)).toBe('Screen author');
    expect(authorTag(comment(1, 'RETURN'), 2)).toBe('Reviewer');
    expect(authorTag(comment(1, 'APPROVE'), 2)).toBe('Reviewer');
    expect(authorTag(comment(2, 'RETURN'), 2)).toBe('Reviewer');
    expect(authorTag(comment(5, null), 2)).toBeNull();
  });
});

describe('formatCommentTime', () => {
  const now = new Date(2026, 9, 20, 12, 0);

  it('writes "Oct 2 · 11:05" in local time, with the year only when it is not the current one', () => {
    expect(formatCommentTime('2026-10-02T11:05:00', now)).toBe('Oct 2 · 11:05');
    expect(formatCommentTime('2025-12-31T09:03:00', now)).toBe('Dec 31, 2025 · 09:03');
  });

  it('returns what it cannot read unchanged', () => {
    expect(formatCommentTime('not a date', now)).toBe('not a date');
  });
});
