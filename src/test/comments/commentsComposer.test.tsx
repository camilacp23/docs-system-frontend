// Comments tab, the composer (S-35): the text goes as typed (D-122), the counter, the blank text, the 201 (the comment
// at the end, the badge and the panel count), the ETag of the screen that moves with the count without a false 412 (D-101),
// the three roles, and the blocks: archived application, no connection, and the API's own refusal.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeComment, openComments } from '../helpers/openComments';
import { setupUser } from '../helpers/setupUser';

afterEach(() => {
  vi.restoreAllMocks();
});

const box = () => screen.getByLabelText('Add a comment');
const sendButton = () => screen.getByRole('button', { name: 'Comment' });
const posts = (view: Awaited<ReturnType<typeof openComments>>) =>
  view.api.callsTo('POST /screens/{id}/comments');
const articles = () =>
  within(screen.getByRole('list', { name: 'Comments of this screen' })).getAllByRole('article');

describe('writing a comment', () => {
  it('has a label, a counter tied to the box and the frame placeholder', async () => {
    const user = setupUser();
    await openComments();

    expect(box()).toHaveAttribute('placeholder', 'Add a comment for this screen…');
    expect(screen.getByText('Plain text · 0 / 4000')).toBeVisible();
    expect(box()).toHaveAttribute('aria-describedby', expect.stringContaining('-counter'));

    await user.type(box(), 'abc');
    expect(screen.getByText('Plain text · 3 / 4000')).toBeVisible();
    const counterId = (box().getAttribute('aria-describedby') ?? '').split(' ')[0] as string;
    expect(document.getElementById(counterId)).toHaveTextContent('Plain text · 3 / 4000');
  });

  it('takes at most 4000 characters', async () => {
    await openComments();

    expect(box()).toHaveAttribute('maxlength', '4000');
  });

  it('sends the text exactly as typed: spaces and line breaks are kept (D-122)', async () => {
    const user = setupUser();
    const view = await openComments();

    await user.type(box(), '  first line{Enter}  second line  ');
    await user.click(sendButton());

    await waitFor(() => {
      expect(posts(view)).toHaveLength(1);
    });
    expect(posts(view)[0]?.options.body).toEqual({ text: '  first line\n  second line  ' });
    expect(posts(view)[0]?.options.path).toEqual({ id: 12 });
  });

  it('puts the new comment at the end, empties the box and keeps the focus there', async () => {
    const user = setupUser();
    await openComments();

    await user.type(box(), 'A new question');
    await user.click(sendButton());

    expect(await screen.findByText('A new question')).toBeVisible();
    const last = articles().at(-1) as HTMLElement;
    expect(within(last).getByText('A new question')).toBeVisible();
    expect(within(last).getByText('Ana Mora')).toBeVisible();
    expect(articles()).toHaveLength(5);
    expect(box()).toHaveValue('');
    await waitFor(() => {
      expect(box()).toHaveFocus();
    });
  });

  it('updates the counter of the tab, the side panel and the Template card, and announces it', async () => {
    const user = setupUser();
    await openComments();

    await user.type(box(), 'Another one');
    await user.click(sendButton());

    await screen.findByText('Another one');
    expect(screen.getByRole('tab', { name: /Comments/ })).toHaveTextContent('Comments5');
    const panel = screen.getByRole('complementary', { name: 'About this discussion' });
    expect(within(panel).getByText('Comments').nextElementSibling?.textContent).toBe('5');
    expect(within(panel).getByText('Ana Mora')).toBeVisible();
    expect(screen.getByText('Comment added.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Template/ }));
    const row = (await screen.findByText('Comments', { selector: 'dt' })).closest('div');
    expect(within(row as HTMLElement).getByText('5')).toBeVisible();
  });

  it('lets every role comment, in any status', async () => {
    for (const role of ['ADMINISTRATOR', 'DEVELOPER', 'READER'] as const) {
      for (const status of ['IN_REVIEW', 'APPROVED', 'DRAFT'] as const) {
        const user = setupUser();
        const view = await openComments({ role, status, comments: [makeComment(1)] });
        expect(box(), `${role} ${status}`).toBeEnabled();
        await user.type(box(), `from ${role}`);
        await user.click(sendButton());
        expect(await screen.findByText(`from ${role}`)).toBeVisible();
        expect(posts(view)).toHaveLength(1);
        view.unmount();
      }
    }
  });
});

describe('a text that cannot be sent', () => {
  it('does not send a blank text, says why, ties the message to the box and clears it when typing', async () => {
    const user = setupUser();
    const view = await openComments();

    await user.type(box(), '   ');
    await user.click(sendButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Write a comment before sending it.');
    expect(posts(view)).toHaveLength(0);
    expect(box()).toHaveAttribute('aria-invalid', 'true');
    expect(box().getAttribute('aria-describedby')).toContain(alert.id);
    expect(box()).toHaveFocus();

    await user.type(box(), 'x');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(box()).not.toHaveAttribute('aria-invalid');
  });

  it('shows the same message when the API answers 400 on the text (pattern)', async () => {
    const user = setupUser();
    await openComments({
      prepare: (api) => {
        api.failNext(
          'POST /screens/{id}/comments',
          new ApiError({
            status: 400,
            code: 'VALIDATION_ERROR',
            details: { fields: [{ field: 'text', rule: 'pattern', message: 'x' }] },
          }),
        );
      },
    });

    await user.type(box(), 'looks fine to the client');
    await user.click(sendButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Write a comment before sending it.',
    );
    expect(box()).toHaveValue('looks fine to the client');
  });

  it('keeps the text and shows the catalog message when the API refuses', async () => {
    const user = setupUser();
    await openComments({
      prepare: (api) => {
        api.failNext(
          'POST /screens/{id}/comments',
          new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' }),
        );
      },
    });

    await user.type(box(), 'It was archived meanwhile');
    await user.click(sendButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This application is archived, so its documentation can't be changed.",
    );
    expect(box()).toHaveValue('It was archived meanwhile');
    expect(articles()).toHaveLength(4);
  });
});

describe('the ETag of the screen moves with the comment count (D-101)', () => {
  it('does not turn the next change of the status into a 412', async () => {
    const user = setupUser();
    const view = await openComments({ role: 'DEVELOPER' });
    const before = view.api.etagOf(12);

    await user.type(box(), 'A comment before withdrawing');
    await user.click(sendButton());
    await screen.findByText('A comment before withdrawing');
    // The tag a GET would send now is another one: it carries the comment count.
    expect(view.api.etagOf(12)).not.toBe(before);

    // The detail still holds the tag it read before the comment, and the server compares only the version part.
    await user.click(screen.getByRole('button', { name: 'Withdraw from review' }));

    expect(await screen.findByText('Detalle withdrawn from review.')).toBeVisible();
    const sent = view.api.callsTo('PUT /screens/{id}/status')[0];
    expect(sent?.options.ifMatch).toBe(before);
    expect(screen.queryByText(/Someone else saved changes/)).toBeNull();
  });
});

describe('writing is blocked', () => {
  it('in an archived application: the box and the button are disabled, with the reason read with the box', async () => {
    const user = setupUser();
    const view = await openComments({ archived: true });

    const reason = screen.getByText('Read-only: the application is archived.', { selector: 'p' });
    expect(box()).toBeDisabled();
    expect(sendButton()).toBeDisabled();
    expect(box().getAttribute('aria-describedby')).toContain(reason.id);
    // The thread is still read.
    expect(screen.getByText('Template ready except Risks; adding them tomorrow.')).toBeVisible();
    await user.click(sendButton());
    expect(posts(view)).toHaveLength(0);
  });

  it('while the browser is offline, with the reason of the S-46 text', async () => {
    await openComments();
    expect(box()).toBeEnabled();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(
      await screen.findByText(
        "You're offline. Changes can't be saved until the connection is back.",
        { selector: 'p' },
      ),
    ).toBeVisible();
    expect(box()).toBeDisabled();
    expect(sendButton()).toBeDisabled();
  });
});
