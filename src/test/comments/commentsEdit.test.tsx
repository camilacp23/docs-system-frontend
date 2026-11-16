// Comments tab, editing one's own comment in line (D-56, D-123): only the author sees Edit, never on a review comment;
// PUT /comments/{id} with the text as typed and If-Match from the formula of D-123 (or the ETag of the last answer); the
// same text changes nothing; the 412 with the S-44 pattern; REVIEW_COMMENT_LOCKED, APPLICATION_ARCHIVED and AUTHOR_ONLY
// with the catalog messages; NOT_FOUND; the blocks; and the focus.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { ANA, CAMILA, DEV_A, makeComment, openComments } from '../helpers/openComments';
import { setupUser } from '../helpers/setupUser';

afterEach(() => {
  vi.restoreAllMocks();
});

const MINE = makeComment(1, {
  author: ANA,
  text: 'My first version',
  createdAt: '2026-10-04T10:00:00',
});
const THEIRS = makeComment(2, {
  author: DEV_A,
  text: 'Not mine',
  createdAt: '2026-10-04T10:05:00',
});

const editButton = () => screen.getByRole('button', { name: /^Edit comment from/ });
const editBox = () => screen.getByLabelText('Edit your comment');
const puts = (view: Awaited<ReturnType<typeof openComments>>) =>
  view.api.callsTo('PUT /comments/{id}');

async function startEditing(user: ReturnType<typeof setupUser>) {
  await user.click(editButton());
  return editBox();
}

describe('who sees Edit', () => {
  it.each(['ADMINISTRATOR', 'DEVELOPER', 'READER'] as const)(
    'offers it to %s on their own ordinary comment only',
    async (role) => {
      await openComments({ role, comments: [MINE, THEIRS] });

      await screen.findByText('Not mine');
      expect(screen.getAllByRole('button', { name: /^Edit comment from/ })).toHaveLength(1);
      const mine = screen.getByText('My first version').closest('article') as HTMLElement;
      expect(within(mine).getByRole('button', { name: /^Edit comment from/ })).toBeVisible();
      const theirs = screen.getByText('Not mine').closest('article') as HTMLElement;
      expect(within(theirs).queryByRole('button', { name: /^Edit comment/ })).toBeNull();
    },
  );

  it("never offers it on a review comment, even the user's own (D-56)", async () => {
    await openComments({
      role: 'ADMINISTRATOR',
      comments: [
        makeComment(1, { author: ANA, reviewDecision: 'RETURN', text: 'Fix this.' }),
        makeComment(2, { author: ANA, reviewDecision: 'APPROVE', text: 'Good.' }),
      ],
    });

    await screen.findByText('Fix this.');
    expect(screen.queryByRole('button', { name: /^Edit comment/ })).toBeNull();
  });
});

describe('editing in line', () => {
  it('opens a labelled box with the text, a counter, Save and Cancel, and puts the focus in the box', async () => {
    const user = setupUser();
    await openComments({ comments: [MINE] });

    const box = await startEditing(user);

    expect(box).toHaveValue('My first version');
    expect(box).toHaveFocus();
    expect(screen.getByText('16 / 4000')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
    // The Edit action is replaced by the editor while it is open.
    expect(screen.queryByRole('button', { name: /^Edit comment from/ })).toBeNull();
  });

  it('saves with the text as typed and an If-Match built with the formula of D-123', async () => {
    const user = setupUser();
    const view = await openComments({ comments: [MINE] });

    const box = await startEditing(user);
    await user.clear(box);
    await user.type(box, '  My second version  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('My second version')).toBeVisible();
    expect(puts(view)).toHaveLength(1);
    expect(puts(view)[0]?.options.body).toEqual({ text: '  My second version  ' });
    expect(puts(view)[0]?.options.path).toEqual({ id: 1 });
    // Never edited: the tag is the epoch ms of createdAt.
    expect(puts(view)[0]?.options.ifMatch).toBe(`W/"${Date.parse('2026-10-04T10:00:00')}"`);
  });

  it('marks the comment as edited, closes the editor, announces it and returns the focus to Edit', async () => {
    const user = setupUser();
    await openComments({ comments: [MINE] });
    const article = () => screen.getByRole('article');
    expect(within(article()).queryByText(/edited/)).toBeNull();

    const box = await startEditing(user);
    await user.type(box, '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(within(article()).getByText(/· edited$/)).toBeVisible();
    });
    expect(screen.queryByLabelText('Edit your comment')).toBeNull();
    expect(screen.getByText('Comment updated.')).toBeInTheDocument();
    await waitFor(() => {
      expect(editButton()).toHaveFocus();
    });
  });

  it('uses the ETag of the last answer for the next edit', async () => {
    const user = setupUser();
    const view = await openComments({ comments: [MINE] });

    let box = await startEditing(user);
    await user.type(box, ' one');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('My first version one');

    const afterFirst = view.api.state.comments.find((comment) => comment.id === 1);
    box = await startEditing(user);
    await user.type(box, ' two');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('My first version one two');

    expect(puts(view)).toHaveLength(2);
    expect(puts(view)[1]?.options.ifMatch).toBe(`W/"${Date.parse(afterFirst?.updatedAt ?? '')}"`);
  });

  it('changes nothing when the text is the same: no request, no "edited" mark', async () => {
    const user = setupUser();
    const view = await openComments({ comments: [MINE] });

    await startEditing(user);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.queryByLabelText('Edit your comment')).toBeNull();
    expect(puts(view)).toHaveLength(0);
    expect(within(screen.getByRole('article')).queryByText(/edited/)).toBeNull();
    expect(view.api.state.comments[0]?.updatedAt).toBeNull();
  });

  it('does not send a blank text and says why', async () => {
    const user = setupUser();
    const view = await openComments({ comments: [MINE] });

    const box = await startEditing(user);
    await user.clear(box);
    await user.type(box, '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Write a comment before sending it.');
    expect(box.getAttribute('aria-describedby')).toContain(alert.id);
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(puts(view)).toHaveLength(0);
  });

  it('cancels without a request and returns the focus to Edit, with the original text', async () => {
    const user = setupUser();
    const view = await openComments({ comments: [MINE] });

    const box = await startEditing(user);
    await user.type(box, ' changed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(puts(view)).toHaveLength(0);
    expect(screen.getByText('My first version')).toBeVisible();
    await waitFor(() => {
      expect(editButton()).toHaveFocus();
    });
  });
});

describe('when the API refuses the edit', () => {
  async function failWith(error: ApiError) {
    const user = setupUser();
    const view = await openComments({
      comments: [MINE],
      prepare: (api) => {
        api.failNext('PUT /comments/{id}', error);
      },
    });
    const box = await startEditing(user);
    await user.type(box, ' edited');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    return { user, view, box };
  }

  it.each([
    [
      'REVIEW_COMMENT_LOCKED',
      new ApiError({ status: 422, code: 'REVIEW_COMMENT_LOCKED' }),
      "Review decisions can't be edited.",
    ],
    [
      'APPLICATION_ARCHIVED',
      new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' }),
      "This application is archived, so its documentation can't be changed.",
    ],
    [
      'AUTHOR_ONLY (403)',
      new ApiError({ status: 403, code: 'FORBIDDEN', details: { reason: 'AUTHOR_ONLY' } }),
      'You can only edit your own comments.',
    ],
  ])(
    'shows the catalog text of %s under the box and keeps what was typed',
    async (_name, error, text) => {
      const { box } = await failWith(error);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(text);
      expect(box.getAttribute('aria-describedby')).toContain(alert.id);
      expect(box).toHaveValue('My first version edited');
      expect(box).toHaveFocus();
    },
  );

  it('says the comment no longer exists on 404, under the box, and keeps what was typed', async () => {
    const { box } = await failWith(
      new ApiError({ status: 404, code: 'NOT_FOUND', details: { element: 'comment', id: 1 } }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("This comment doesn't exist. It may have been deleted.");
    expect(box).toHaveValue('My first version edited');
  });
});

describe('a conflicting edit (412, the S-44 pattern)', () => {
  const CATALOG_SENTENCE =
    'Someone else saved changes to this comment after you opened it. Reload to see their version.';
  const EXPECTED =
    'Someone else saved changes to this comment after you opened it. Reload to see their version. Your changes will be lost, so copy anything you need first.';

  async function conflict() {
    const user = setupUser();
    const view = await openComments({ comments: [MINE] });
    const box = await startEditing(user);
    await user.type(box, ' mine');
    // Someone else edited the comment after it was read.
    view.api.state.comments = view.api.state.comments.map((comment) => ({
      ...comment,
      text: 'Their version',
      updatedAt: '2026-10-04T10:30:00',
    }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(EXPECTED);
    return { user, view, box };
  }

  it('shows the warning banner with the catalog text and the two options, and disables Save', async () => {
    await conflict();

    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(EXPECTED);
    expect(within(banner).getByRole('button', { name: 'Keep my changes visible' })).toBeVisible();
    expect(within(banner).getByRole('button', { name: 'Reload' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByLabelText('Edit your comment')).toHaveValue('My first version mine');
  });

  it('"Keep my changes visible" hides the banner and leaves the sentence next to the box, Save still disabled', async () => {
    const { user } = await conflict();

    await user.click(screen.getByRole('button', { name: 'Keep my changes visible' }));

    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
    // Only the catalog sentence stays next to the box (the pattern of the other edit pages).
    expect(screen.getByRole('alert')).toHaveTextContent(CATALOG_SENTENCE);
    expect(screen.getByRole('alert')).not.toHaveTextContent('Your changes will be lost');
    expect(screen.getByLabelText('Edit your comment')).toHaveValue('My first version mine');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('"Reload" closes the editor and shows their version', async () => {
    const { user, view } = await conflict();

    await user.click(screen.getByRole('button', { name: 'Reload' }));

    expect(await screen.findByText('Their version')).toBeVisible();
    expect(screen.queryByLabelText('Edit your comment')).toBeNull();
    expect(view.api.callsTo('GET /screens/{id}/comments')).toHaveLength(2);
  });
});

describe('Edit is blocked', () => {
  it('in an archived application, with the reason', async () => {
    await openComments({ comments: [MINE], archived: true });

    const button = await screen.findByRole('button', { name: /^Edit comment from/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Read-only: the application is archived.');
  });

  it('while offline, with the reason', async () => {
    await openComments({ comments: [MINE] });
    expect(await screen.findByRole('button', { name: /^Edit comment from/ })).toBeEnabled();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(editButton()).toBeDisabled();
    });
    expect(editButton()).toHaveAttribute(
      'title',
      "You're offline. Changes can't be saved until the connection is back.",
    );
  });
});

describe('the review comments stay out of reach', () => {
  it('shows a review of Camila without Edit to her, and to anyone else', async () => {
    await openComments({
      role: 'ADMINISTRATOR',
      comments: [makeComment(1, { author: CAMILA, reviewDecision: 'RETURN', text: 'Fix.' })],
    });

    await screen.findByText('Fix.');
    expect(screen.queryByRole('button', { name: /^Edit comment/ })).toBeNull();
  });
});
