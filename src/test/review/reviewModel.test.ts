// reviewModel: the relative time of a row, what the panel says about a screen, and which row is selected after a decision.
import { describe, expect, it } from 'vitest';

import {
  nextSelection,
  REVIEW_PAGE_SIZE,
  relativeTime,
  reviewSummary,
} from '../../modules/review/reviewModel';
import { makeScreenDetail } from '../helpers/fakeScreensApi';
import { reviewScreen } from '../helpers/openReview';

describe('relativeTime', () => {
  const now = new Date(2026, 9, 6, 16, 2, 0).getTime();
  const ago = (ms: number) => relativeTime(new Date(now - ms).toISOString(), now);
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it('says how long ago an instant was, rounded down, in English', () => {
    expect(ago(20_000)).toBe('just now');
    expect(ago(MINUTE)).toBe('1 minute ago');
    expect(ago(45 * MINUTE)).toBe('45 minutes ago');
    expect(ago(HOUR)).toBe('1 hour ago');
    expect(ago(23 * HOUR + 59 * MINUTE)).toBe('23 hours ago');
    expect(ago(DAY)).toBe('1 day ago');
    expect(ago(2 * DAY + 3 * HOUR)).toBe('2 days ago');
    expect(ago(59 * DAY)).toBe('59 days ago');
    expect(ago(65 * DAY)).toBe('2 months ago');
  });

  it('never says the future, and returns what it cannot read unchanged', () => {
    expect(relativeTime(new Date(now + HOUR).toISOString(), now)).toBe('just now');
    expect(relativeTime('not a date', now)).toBe('not a date');
  });

  it('pages of 20', () => {
    expect(REVIEW_PAGE_SIZE).toBe(20);
  });
});

describe('reviewSummary', () => {
  it('counts the template fields with content, distinct links and the Subtasks', () => {
    const summary = reviewSummary(
      reviewScreen(1, 'X', {
        pendingSubtasks: 3,
        miroLink: 'https://miro.com/x',
        variableLinks: [
          {
            id: 1,
            variable: { id: 3, name: 'a' },
            accessMode: 'READ',
            usedIn: 'u',
            isOrigin: false,
          },
          {
            id: 2,
            variable: { id: 3, name: 'a' },
            accessMode: 'WRITE',
            usedIn: 'v',
            isOrigin: false,
          },
          {
            id: 3,
            variable: { id: 4, name: 'b' },
            accessMode: 'READ',
            usedIn: 'w',
            isOrigin: false,
          },
        ],
        collectionLinks: [
          { id: 4, collection: { id: 9, name: 'c' }, accessMode: 'READ', usedIn: 'x' },
        ],
        components: [
          { id: 7, name: 'btn', type: 'Button', onSelect: null, description: null, uses: [] },
        ],
      }),
    );

    expect(summary.template).toEqual({ done: 7, total: 7, complete: true });
    expect(summary.links).toBe('2 variables · 1 collection · 1 component');
    expect(summary.todo).toBe('3 Subtasks pending in Jira');
    expect(summary.miro).toBe('Linked');
    expect(summary.fields).toHaveLength(7);
    expect(summary.fields.every((field) => field.done)).toBe(true);
  });

  it('says what is missing: an incomplete template, nothing linked, no Subtasks, no Miro', () => {
    const summary = reviewSummary(
      makeScreenDetail(2, 'Y', {
        template: {
          onStart: 'x',
          workingProcess: '   ',
          architecture: null,
          dataModel: null,
          requirements: null,
          knownIssues: null,
          risks: null,
        },
        pendingSubtasks: 1,
      }),
    );

    expect(summary.template).toEqual({ done: 1, total: 7, complete: false });
    expect(summary.links).toBe('Nothing is linked yet.');
    expect(summary.todo).toBe('1 Subtask pending in Jira');
    expect(makeScreenDetail(3, 'Z').pendingSubtasks).toBe(0);
    expect(reviewSummary(makeScreenDetail(3, 'Z')).todo).toBe('No pending Subtasks');
    expect(summary.miro).toBe('Not linked');
    expect(summary.fields.map((field) => field.done)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('nextSelection', () => {
  it('takes the row that took its place, else the one before, else nothing', () => {
    expect(nextSelection([1, 2, 3], 1)).toBe(2);
    expect(nextSelection([1, 2, 3], 2)).toBe(3);
    expect(nextSelection([1, 2, 3], 3)).toBe(2);
    expect(nextSelection([1], 1)).toBeNull();
    expect(nextSelection([], 5)).toBeNull();
    expect(nextSelection([4, 5], 9)).toBe(4);
  });
});
