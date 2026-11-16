// Comments tab, the pagination of the thread (D-144): pages of 50 read from the newest end with the commentCount of the
// detail, "Load earlier comments" above, the thread kept oldest first, the correction when the thread grew between the
// read of the detail and the read of the thread, and a failed read of an earlier page.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeComment, openComments } from '../helpers/openComments';
import { setupUser } from '../helpers/setupUser';

/** `count` comments with ids 1..count, oldest first. */
function manyComments(count: number) {
  return Array.from({ length: count }, (_, index) =>
    makeComment(index + 1, {
      text: `Comment ${index + 1}`,
      createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, index)).toISOString(),
    }),
  );
}

const pagesRead = (view: Awaited<ReturnType<typeof openComments>>) =>
  view.api
    .callsTo('GET /screens/{id}/comments')
    .map((call) => [call.options.query?.page, call.options.query?.pageSize]);

const listed = () =>
  within(screen.getByRole('list', { name: 'Comments of this screen' }))
    .getAllByRole('article')
    .map((article) => within(article).getByText(/^Comment \d+$/).textContent);

describe('the first read', () => {
  it('asks for the last page, computed from the commentCount of the detail, in one request', async () => {
    const view = await openComments({ comments: manyComments(120) });

    await screen.findByText('Comment 120');
    expect(pagesRead(view)).toEqual([[3, 50]]);
    expect(listed()).toHaveLength(20);
    expect(listed().at(0)).toBe('Comment 101');
    expect(listed().at(-1)).toBe('Comment 120');
    expect(screen.getByText('100 earlier comments')).toBeVisible();
  });

  it('reads a thread of exactly one page without offering earlier comments', async () => {
    const view = await openComments({ comments: manyComments(50) });

    await screen.findByText('Comment 50');
    expect(pagesRead(view)).toEqual([[1, 50]]);
    expect(listed()).toHaveLength(50);
    expect(screen.queryByRole('button', { name: 'Load earlier comments' })).toBeNull();
  });

  it('keeps the count of the tab and the panel as the thread says it', async () => {
    await openComments({ comments: manyComments(120) });

    await screen.findByText('Comment 120');
    expect(screen.getByRole('tab', { name: /Comments/ })).toHaveTextContent('Comments120');
    const panel = screen.getByRole('complementary', { name: 'About this discussion' });
    expect(within(panel).getByText('Comments').nextElementSibling?.textContent).toBe('120');
    expect(within(panel).getByText('Based on the comments loaded so far.')).toBeVisible();
  });
});

describe('a comment arrives between the detail and the thread', () => {
  it('reads the new last page when the total says the last page is another one', async () => {
    // The detail still says 50 comments (one page); the API already has 51: the newest is on page 2.
    const view = await openComments({ comments: manyComments(51), commentCount: 50 });

    await screen.findByText('Comment 51');
    expect(pagesRead(view)).toEqual([
      [1, 50],
      [2, 50],
    ]);
    expect(listed()).toEqual(['Comment 51']);
    expect(screen.getByText('50 earlier comments')).toBeVisible();
  });

  it('does not read twice when the last page is still the right one', async () => {
    // The detail says 49 and the API has 50: both are on page 1.
    const view = await openComments({ comments: manyComments(50), commentCount: 49 });

    await screen.findByText('Comment 50');
    expect(pagesRead(view)).toEqual([[1, 50]]);
    expect(listed()).toHaveLength(50);
  });

  it('shows the newest comment even when the detail knew of none', async () => {
    const view = await openComments({ comments: manyComments(1), commentCount: 0 });

    await screen.findByText('Comment 1');
    expect(pagesRead(view)).toEqual([[1, 50]]);
  });
});

describe('Load earlier comments', () => {
  it('puts the previous page above, keeps the order, and goes away when there is nothing older', async () => {
    const user = setupUser();
    const view = await openComments({ comments: manyComments(120) });
    await screen.findByText('Comment 120');

    await user.click(screen.getByRole('button', { name: 'Load earlier comments' }));
    await screen.findByText('Comment 51');
    expect(pagesRead(view)).toEqual([
      [3, 50],
      [2, 50],
    ]);
    expect(listed()).toHaveLength(70);
    expect(listed().at(0)).toBe('Comment 51');
    expect(screen.getByText('50 earlier comments')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Load earlier comments' }));
    await screen.findByText('Comment 1');
    expect(listed()).toHaveLength(120);
    expect(listed()).toEqual(manyComments(120).map((comment) => comment.text));
    expect(screen.queryByRole('button', { name: 'Load earlier comments' })).toBeNull();
    const panel = screen.getByRole('complementary', { name: 'About this discussion' });
    expect(within(panel).queryByText('Based on the comments loaded so far.')).toBeNull();
  });

  it('says so when an earlier page cannot be read, keeps what is shown and lets the user try again', async () => {
    const user = setupUser();
    const view = await openComments({ comments: manyComments(120) });
    await screen.findByText('Comment 120');
    view.api.failNext(
      'GET /screens/{id}/comments',
      new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
    );

    await user.click(screen.getByRole('button', { name: 'Load earlier comments' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The earlier comments couldn't be loaded. Try again.",
    );
    expect(listed()).toHaveLength(20);

    await user.click(screen.getByRole('button', { name: 'Load earlier comments' }));
    await screen.findByText('Comment 51');
    expect(listed()).toHaveLength(70);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
