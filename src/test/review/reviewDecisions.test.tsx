// Review queue (S-36, S-37, S-37b, S-37c), the decisions: who decides (Administrator) and who only reads (Developer, D-145),
// the Reader's No access, Return with its required comment (client check, 400 on the field, 422 COMMENT_REQUIRED), Approve
// with an optional comment, what happens after a decision (the row leaves, the next one is selected, the toast, the focus),
// NOT_IN_REVIEW and APPLICATION_ARCHIVED (their message and a fresh read of the queue), the writes blocked by an archived
// application or no connection, and the focus of the modals. The modal is the one of the screen detail (D-142).
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeApplication } from '../helpers/renderApp';
import { openReview, reviewScreen } from '../helpers/openReview';
import { renderScreens, sampleScreens } from '../helpers/renderScreens';
import { setupUser } from '../helpers/setupUser';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const REQUIRED_TEXT = 'Write a comment: it is required to return the documentation.';
const rowNames = () =>
  within(screen.getByRole('list', { name: 'Screens waiting for review' }))
    .getAllByRole('button')
    .map((button) => button.querySelector('span')?.textContent);
const reviews = (view: Awaited<ReturnType<typeof openReview>>) =>
  view.api.callsTo('POST /screens/{id}/review');
const queueReads = (view: Awaited<ReturnType<typeof openReview>>) =>
  view.api.callsTo('GET /screens').filter((call) => call.options.query?.sort === 'updatedAt');

async function openReturn(user: ReturnType<typeof setupUser>, name = 'Reportes') {
  await user.click(screen.getByRole('button', { name: 'Return for changes' }));
  return within(await screen.findByRole('dialog', { name: `Return ${name} to “In progress”` }));
}

async function openApprove(user: ReturnType<typeof setupUser>, name = 'Reportes') {
  await user.click(screen.getByRole('button', { name: 'Approve' }));
  return within(await screen.findByRole('dialog', { name: `Approve ${name}?` }));
}

describe('who decides', () => {
  it('gives the Administrator "Return for changes" and "Approve", with the note about the comment', async () => {
    await openReview({ role: 'ADMINISTRATOR' });

    expect(await screen.findByRole('button', { name: 'Return for changes' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
    expect(screen.getByText('Returning requires a comment for the author.')).toBeVisible();
  });

  it('shows the Developer the same queue and panel read only, with a note and no decisions (D-145)', async () => {
    await openReview({ role: 'DEVELOPER' });

    expect(await screen.findByRole('heading', { name: 'Reportes', level: 2 })).toBeVisible();
    expect(rowNames()).toEqual(['Reportes', 'Busqueda', 'Detalle']);
    expect(screen.getByText('Only an Administrator can approve or return a screen.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return for changes' })).not.toBeInTheDocument();
    expect(
      screen.queryByText('Returning requires a comment for the author.'),
    ).not.toBeInTheDocument();
    // Reading still works: the panel opens the screen.
    expect(screen.getByRole('button', { name: 'Open screen' })).toBeEnabled();
  });

  it('gives the Reader no Review item and "No access" on the route', async () => {
    const view = await renderScreens({ role: 'READER', path: '/review' });

    expect(
      await screen.findByText(
        "Your role (Reader) doesn't include it. Ask an administrator if you need it.",
      ),
    ).toBeVisible();
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', {
        name: /^Review/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Screens waiting for review' }),
    ).not.toBeInTheDocument();
    expect(
      view.api.callsTo('GET /screens').filter((call) => call.options.query?.sort === 'updatedAt'),
    ).toHaveLength(0);
  });
});

describe('Return (S-37b)', () => {
  it('opens the modal of the frame with the comment required', async () => {
    const user = setupUser();
    await openReview();
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });

    const dialog = await openReturn(user);

    expect(dialog.getByText('The author will see your comment and can edit again.')).toBeVisible();
    expect(dialog.getByLabelText(/Comment for the author/)).toHaveFocus();
    expect(dialog.getByText("It is posted on the screen's comments.")).toBeVisible();
  });

  it('does not send a blank comment and says why, on the field', async () => {
    const user = setupUser();
    const view = await openReview();
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });
    const dialog = await openReturn(user);

    await user.type(dialog.getByLabelText(/Comment for the author/), '   ');
    await user.click(dialog.getByRole('button', { name: 'Return' }));

    const box = dialog.getByLabelText(/Comment for the author/);
    expect(await dialog.findByText(REQUIRED_TEXT)).toBeVisible();
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box.getAttribute('aria-describedby')).toContain(`${box.id}-error`);
    expect(reviews(view)).toHaveLength(0);
  });

  it('shows the 400 of the API on the comment field', async () => {
    const user = setupUser();
    await openReview({
      prepare: (api) => {
        api.failNext(
          'POST /screens/{id}/review',
          new ApiError({
            status: 400,
            code: 'VALIDATION_ERROR',
            details: { fields: [{ field: 'comment', rule: 'maxLength', message: 'x' }] },
          }),
        );
      },
    });
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });
    const dialog = await openReturn(user);

    await user.type(dialog.getByLabelText(/Comment for the author/), 'text');
    await user.click(dialog.getByRole('button', { name: 'Return' }));

    expect(await dialog.findByText('Comment is too long.')).toBeVisible();
  });

  it('shows the 422 COMMENT_REQUIRED of the API on the comment field (D-88)', async () => {
    const user = setupUser();
    await openReview({
      prepare: (api) => {
        api.failNext(
          'POST /screens/{id}/review',
          new ApiError({ status: 422, code: 'COMMENT_REQUIRED' }),
        );
      },
    });
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });
    const dialog = await openReturn(user);

    await user.type(dialog.getByLabelText(/Comment for the author/), 'looks fine to the client');
    await user.click(dialog.getByRole('button', { name: 'Return' }));

    expect(await dialog.findByText(REQUIRED_TEXT)).toBeVisible();
    expect(dialog.getByLabelText(/Comment for the author/)).toHaveFocus();
  });

  it('sends the comment as typed, takes the row out of the queue and selects the next one', async () => {
    const user = setupUser();
    const view = await openReview();
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });
    const dialog = await openReturn(user);

    await user.type(dialog.getByLabelText(/Comment for the author/), '  Fix the risks.  ');
    await user.click(dialog.getByRole('button', { name: 'Return' }));

    await waitFor(() => {
      expect(rowNames()).toEqual(['Busqueda', 'Detalle']);
    });
    expect(reviews(view)[0]?.options.body).toEqual({
      decision: 'RETURN',
      comment: '  Fix the risks.  ',
    });
    expect(reviews(view)[0]?.options.path).toEqual({ id: 14 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Busqueda', level: 2 })).toBeVisible();
    expect(screen.getByText('2 screens waiting for a decision · oldest first')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Waiting', level: 2 }).parentElement,
    ).toHaveTextContent('Waiting2');
    expect(view.api.state.screens.find((s) => s.id === 14)?.documentationStatus).toBe(
      'IN_PROGRESS',
    );
  });

  it('says what happened in a toast and puts the focus on the next screen, since the button is gone', async () => {
    const user = setupUser();
    await openReview();
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });
    const dialog = await openReturn(user);

    await user.type(dialog.getByLabelText(/Comment for the author/), 'Fix.');
    await user.click(dialog.getByRole('button', { name: 'Return' }));

    expect(await screen.findByText('Reportes returned to In progress.')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Busqueda', level: 2 })).toHaveFocus();
    });
  });
});

describe('Approve (S-37c)', () => {
  it('approves without a comment: nothing is sent for it', async () => {
    const user = setupUser();
    const view = await openReview();
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });
    const dialog = await openApprove(user);

    expect(dialog.getByText('Comment (optional)')).toBeVisible();
    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Reportes approved.')).toBeVisible();
    expect(reviews(view)[0]?.options.body).toEqual({ decision: 'APPROVE' });
    expect(rowNames()).toEqual(['Busqueda', 'Detalle']);
    expect(view.api.state.screens.find((s) => s.id === 14)?.documentationStatus).toBe('APPROVED');
  });

  it('approves with the comment as typed', async () => {
    const user = setupUser();
    const view = await openReview();
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });
    const dialog = await openApprove(user);

    await user.type(dialog.getByLabelText('Comment (optional)'), ' Well done ');
    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    await screen.findByText('Reportes approved.');
    expect(reviews(view)[0]?.options.body).toEqual({ decision: 'APPROVE', comment: ' Well done ' });
  });

  it('decides on the row that is selected, and selects the one that took its place', async () => {
    const user = setupUser();
    const view = await openReview();
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });
    await user.click(
      within(screen.getByRole('list', { name: 'Screens waiting for review' })).getByRole('button', {
        name: /Busqueda/,
      }),
    );
    await screen.findByRole('heading', { name: 'Busqueda', level: 2 });
    const dialog = await openApprove(user, 'Busqueda');

    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    await screen.findByText('Busqueda approved.');
    expect(reviews(view)[0]?.options.path).toEqual({ id: 13 });
    expect(rowNames()).toEqual(['Reportes', 'Detalle']);
    expect(screen.getByRole('heading', { name: 'Detalle', level: 2 })).toBeVisible();
  });

  it('shows the empty queue, with the focus on the title, when the last one is decided', async () => {
    const user = setupUser();
    await openReview({
      screens: [...sampleScreens().filter((s) => s.id !== 12), reviewScreen(12, 'Detalle')],
    });
    await screen.findByRole('heading', { name: 'Detalle', level: 2 });
    const dialog = await openApprove(user, 'Detalle');

    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Nothing is waiting for review')).toBeVisible();
    expect(screen.getByText('0 screens waiting for a decision · oldest first')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Review', level: 1 })).toHaveFocus();
    });
  });
});

describe('when someone decided first, or the application was archived', () => {
  it('NOT_IN_REVIEW: shows its message, closes the modal and reads the queue again', async () => {
    const user = setupUser();
    const view = await openReview();
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });
    const dialog = await openApprove(user);
    // Another administrator approved Reportes meanwhile.
    view.api.state.screens = view.api.state.screens.map((s) =>
      s.id === 14 ? { ...s, documentationStatus: 'APPROVED' } : s,
    );
    const readsBefore = queueReads(view).length;

    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    expect(
      await screen.findByText('This screen is no longer in review. Reload to see its status.'),
    ).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(rowNames()).toEqual(['Busqueda', 'Detalle']);
    });
    expect(queueReads(view).length).toBe(readsBefore + 1);
    expect(screen.getByRole('heading', { name: 'Busqueda', level: 2 })).toBeVisible();
  });

  it('APPLICATION_ARCHIVED: shows its message in the modal and reads the queue again', async () => {
    const user = setupUser();
    const view = await openReview({
      prepare: (api) => {
        api.failNext(
          'POST /screens/{id}/review',
          new ApiError({ status: 422, code: 'APPLICATION_ARCHIVED' }),
        );
      },
    });
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });
    const dialog = await openApprove(user);
    const readsBefore = queueReads(view).length;

    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    expect(
      await dialog.findByText(
        "This application is archived, so its documentation can't be changed.",
      ),
    ).toBeVisible();
    await waitFor(() => {
      expect(queueReads(view).length).toBe(readsBefore + 1);
    });
    expect(rowNames()).toEqual(['Reportes', 'Busqueda', 'Detalle']);
  });

  it('NOT_FOUND (the screen was deleted): shows the catalog text and reads the queue again', async () => {
    const user = setupUser();
    const view = await openReview({
      prepare: (api) => {
        api.failNext(
          'POST /screens/{id}/review',
          new ApiError({ status: 404, code: 'NOT_FOUND', details: { element: 'screen', id: 14 } }),
        );
      },
    });
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });
    const dialog = await openApprove(user);
    const readsBefore = queueReads(view).length;

    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    expect(
      await screen.findByText("This screen doesn't exist. It may have been deleted."),
    ).toBeVisible();
    await waitFor(() => {
      expect(queueReads(view).length).toBe(readsBefore + 1);
    });
  });
});

describe('writing is blocked', () => {
  it('in an archived application: the decisions are disabled with the reason, read with the buttons', async () => {
    const user = setupUser();
    await openReview({ applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })] });

    const approve = await screen.findByRole('button', { name: 'Approve' });
    const reason = screen.getByText('Read-only: the application is archived.');
    expect(approve).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Return for changes' })).toBeDisabled();
    expect(approve.getAttribute('aria-describedby')).toBe(reason.id);
    await user.click(approve);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The queue is still read.
    expect(rowNames()).toEqual(['Reportes', 'Busqueda', 'Detalle']);
  });

  it('while offline, with the S-46 text', async () => {
    await openReview();
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeEnabled();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Return for changes' })).toBeDisabled();
    expect(
      screen.getByText("You're offline. Changes can't be saved until the connection is back."),
    ).toBeVisible();
  });
});

describe('the modals', () => {
  it('trap the focus, and return it to the button that opened them on Cancel and on Escape', async () => {
    const user = setupUser();
    await openReview();
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });

    for (const [button, close] of [
      ['Return for changes', 'cancel'],
      ['Return for changes', 'escape'],
      ['Approve', 'cancel'],
    ] as const) {
      await user.click(screen.getByRole('button', { name: button }));
      const dialog = await screen.findByRole('dialog');
      for (let step = 0; step < 6; step += 1) {
        await user.tab();
        expect(dialog.contains(document.activeElement), `${button} tab ${step}`).toBe(true);
      }
      if (close === 'cancel')
        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      else await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: button }), `${button} ${close}`).toHaveFocus();
    }
  });

  it('are the same modals the screen detail opens (no second review)', async () => {
    const user = setupUser();
    const view = await openReview();
    await screen.findByRole('heading', { name: 'Reportes', level: 2 });

    await view.router.navigate('/screens/14');
    await screen.findByRole('heading', { name: 'Reportes', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByRole('dialog', { name: 'Approve Reportes?' })).toBeVisible();
  });
});
