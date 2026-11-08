// Approve and Return a screen in review (S-37c, S-37b, P-02): the two modals of the detail, the comment (optional to
// approve, required to return, checked after trimming in the client and again by the API), the answer taken by the
// detail without another read, the refusals (NOT_IN_REVIEW, COMMENT_REQUIRED, a 400 on the comment, APPLICATION_ARCHIVED,
// a screen that no longer exists), and the focus and keyboard of the modals.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { Role } from '../../app/router/routes';
import type { Screen } from '../../modules/screens/screenTypes';
import { makeApplication } from '../helpers/renderApp';
import { renderScreens, sampleScreens } from '../helpers/renderScreens';
import { replaceText } from '../helpers/screenEditHelpers';
import { setupUser } from '../helpers/setupUser';

const REQUIRED_TEXT = 'Write a comment: it is required to return the documentation.';
const RETURN_TITLE = 'Return Detalle to “In progress”';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Detalle (12) in review (as in the sample data), opened as `role`. */
async function open(
  role: Role = 'ADMINISTRATOR',
  options: { status?: Screen['documentationStatus']; archived?: boolean } = {},
) {
  const view = await renderScreens({
    role,
    path: '/screens/12',
    applications: options.archived
      ? [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })]
      : undefined,
    screens: sampleScreens().map((s) =>
      s.id === 12 ? { ...s, documentationStatus: options.status ?? 'IN_REVIEW' } : s,
    ),
  });
  await screen.findByRole('heading', { name: 'Detalle', level: 1 });
  return view;
}

const stored = (view: Awaited<ReturnType<typeof open>>) =>
  view.api.state.screens.find((s) => s.id === 12);

const reviewCalls = (view: Awaited<ReturnType<typeof open>>) =>
  view.api.callsTo('POST /screens/{id}/review');

async function openApprove(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByRole('button', { name: 'Approve' }));
  return within(await screen.findByRole('dialog', { name: 'Approve Detalle?' }));
}

async function openReturn(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByRole('button', { name: 'Return' }));
  return within(await screen.findByRole('dialog', { name: RETURN_TITLE }));
}

describe('who can decide', () => {
  it('shows Approve and Return to the Administrator in review, and to nobody else', async () => {
    for (const [role, status, visible] of [
      ['ADMINISTRATOR', 'IN_REVIEW', true],
      ['DEVELOPER', 'IN_REVIEW', false],
      ['READER', 'IN_REVIEW', false],
      ['ADMINISTRATOR', 'IN_PROGRESS', false],
      ['ADMINISTRATOR', 'APPROVED', false],
    ] as const) {
      const view = await open(role, { status });
      expect(screen.queryByRole('button', { name: 'Approve' }) !== null, `${role} ${status}`).toBe(
        visible,
      );
      expect(screen.queryByRole('button', { name: 'Return' }) !== null, `${role} ${status}`).toBe(
        visible,
      );
      view.unmount();
    }
  });

  it('puts Approve as the primary button after the disabled Edit (S-25b)', async () => {
    await open();

    const names = screen.getAllByRole('button').map((button) => button.textContent);
    const edit = names.indexOf('Edit');
    expect(names.indexOf('Return')).toBeGreaterThan(edit);
    expect(names.indexOf('Approve')).toBeGreaterThan(names.indexOf('Return'));
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
  });
});

describe('Approve (S-37c)', () => {
  it('opens a modal with the frame texts and the focus on the optional comment', async () => {
    const user = setupUser();
    await open();

    const dialog = await openApprove(user);

    expect(
      dialog.getByText(
        'Detalle becomes the official reference. Editing it later returns it to In progress.',
      ),
    ).toBeVisible();
    expect(dialog.getByRole('textbox', { name: 'Comment (optional)' })).toHaveFocus();
    expect(dialog.getByText('Posted on the screen’s comments.')).toBeVisible();
    expect(dialog.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(dialog.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('approves without a comment: sends no comment, no If-Match, and the status shows Approved (P-02)', async () => {
    const user = setupUser();
    const view = await open();
    const reads = view.api.callsTo('GET /screens/{id}').length;
    const dialog = await openApprove(user);

    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Detalle approved.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(reviewCalls(view)).toHaveLength(1);
    expect(reviewCalls(view)[0]?.options.body).toEqual({ decision: 'APPROVE' });
    expect(reviewCalls(view)[0]?.options.ifMatch).toBeUndefined();
    expect(stored(view)?.documentationStatus).toBe('APPROVED');
    expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    // The detail took the answer: no second read, and Edit is available again.
    expect(view.api.callsTo('GET /screens/{id}')).toHaveLength(reads);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Detalle', level: 1 })).toHaveFocus();
  });

  it('approves with a comment, sent as typed, and the screen gains a comment', async () => {
    const user = setupUser();
    const view = await open();
    const before = stored(view)?.commentCount ?? 0;
    const dialog = await openApprove(user);

    await replaceText(user, dialog.getByRole('textbox'), '  Good level of detail; thanks. ');
    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    await screen.findByText('Detalle approved.');
    expect(reviewCalls(view)[0]?.options.body).toEqual({
      decision: 'APPROVE',
      comment: '  Good level of detail; thanks. ',
    });
    expect(stored(view)?.commentCount).toBe(before + 1);
  });

  it('does not send a comment of only spaces', async () => {
    const user = setupUser();
    const view = await open();
    const before = stored(view)?.commentCount ?? 0;
    const dialog = await openApprove(user);

    await replaceText(user, dialog.getByRole('textbox'), '   ');
    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    await screen.findByText('Detalle approved.');
    expect(reviewCalls(view)[0]?.options.body).toEqual({ decision: 'APPROVE' });
    expect(stored(view)?.commentCount).toBe(before);
  });

  it('uses the new ETag afterwards: the next change sends it', async () => {
    const user = setupUser();
    const view = await open();
    const dialog = await openApprove(user);
    await user.click(dialog.getByRole('button', { name: 'Approve' }));
    await screen.findByText('Detalle approved.');

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Reopen' }));

    expect(
      await screen.findByText('Detalle reopened. Its status is now In progress.'),
    ).toBeVisible();
    const puts = view.api.callsTo('PUT /screens/{id}/status');
    expect(puts[0]?.options.ifMatch).toBe(
      view.api.etagOf(12).replace(/\d+/, (n) => String(Number(n) - 1)),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Return (S-37b)', () => {
  it('opens a modal with the frame texts, a counter and the focus on the comment', async () => {
    const user = setupUser();
    await open();

    const dialog = await openReturn(user);

    expect(dialog.getByText('The author will see your comment and can edit again.')).toBeVisible();
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'The author will see your comment and can edit again.',
    );
    const field = dialog.getByRole('textbox', { name: /Comment for the author/ });
    expect(field).toHaveFocus();
    expect(field).toBeRequired();
    expect(field).toBeValid();
    expect(dialog.getByText('It is posted on the screen’s comments.')).toBeVisible();
    expect(dialog.getByText('0/4000')).toBeVisible();
    expect(field).toHaveAttribute('maxlength', '4000');
  });

  it('counts the characters as they are typed', async () => {
    const user = setupUser();
    await open();
    const dialog = await openReturn(user);

    await replaceText(user, dialog.getByRole('textbox'), 'Fix the risks.');

    expect(dialog.getByText('14/4000')).toBeVisible();
  });

  it('does not send an empty comment: the field says why and keeps the focus', async () => {
    const user = setupUser();
    const view = await open();
    const dialog = await openReturn(user);

    await user.click(dialog.getByRole('button', { name: 'Return' }));

    const field = dialog.getByRole('textbox');
    expect(await dialog.findByText(REQUIRED_TEXT)).toBeVisible();
    expect(field).toBeInvalid();
    expect(field).toHaveAccessibleDescription(new RegExp(REQUIRED_TEXT));
    expect(field).toHaveFocus();
    expect(reviewCalls(view)).toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not send a comment of only spaces, tabs or new lines either', async () => {
    const user = setupUser();
    const view = await open();
    const dialog = await openReturn(user);

    await replaceText(user, dialog.getByRole('textbox'), '  \n\t  ');
    await user.click(dialog.getByRole('button', { name: 'Return' }));

    expect(await dialog.findByText(REQUIRED_TEXT)).toBeVisible();
    expect(reviewCalls(view)).toHaveLength(0);
    expect(stored(view)?.documentationStatus).toBe('IN_REVIEW');
  });

  it('takes the error off when the user writes something', async () => {
    const user = setupUser();
    await open();
    const dialog = await openReturn(user);
    await user.click(dialog.getByRole('button', { name: 'Return' }));
    await dialog.findByText(REQUIRED_TEXT);

    await user.paste('Fix the risks.');

    expect(dialog.queryByText(REQUIRED_TEXT)).not.toBeInTheDocument();
    expect(dialog.getByRole('textbox')).toBeValid();
  });

  it('returns with a valid comment, sent as typed, and the screen goes back to In progress', async () => {
    const user = setupUser();
    const view = await open();
    const before = stored(view)?.commentCount ?? 0;
    const dialog = await openReturn(user);

    await replaceText(user, dialog.getByRole('textbox'), ' Fix the risks. ');
    await user.click(dialog.getByRole('button', { name: 'Return' }));

    expect(await screen.findByText('Detalle returned to In progress.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(reviewCalls(view)[0]?.options.body).toEqual({
      decision: 'RETURN',
      comment: ' Fix the risks. ',
    });
    expect(reviewCalls(view)[0]?.options.ifMatch).toBeUndefined();
    expect(stored(view)?.documentationStatus).toBe('IN_PROGRESS');
    expect(stored(view)?.commentCount).toBe(before + 1);
    expect(screen.getAllByText('In progress').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Detalle', level: 1 })).toHaveFocus();
  });

  it('shows COMMENT_REQUIRED on the field when the API says so', async () => {
    const user = setupUser();
    const view = await open();
    view.api.failNext(
      'POST /screens/{id}/review',
      new ApiError({ status: 422, code: 'COMMENT_REQUIRED' }),
    );
    const dialog = await openReturn(user);

    await replaceText(user, dialog.getByRole('textbox'), 'Fix the risks.');
    await user.click(dialog.getByRole('button', { name: 'Return' }));

    expect(await dialog.findByText(REQUIRED_TEXT)).toBeVisible();
    expect(dialog.getByRole('textbox')).toBeInvalid();
    expect(dialog.getByRole('textbox')).toHaveFocus();
    expect(dialog.getByRole('textbox')).toHaveValue('Fix the risks.');
  });

  it('shows a 400 on the comment on the field, with the catalog text of the rule', async () => {
    const user = setupUser();
    const view = await open();
    view.api.failNext(
      'POST /screens/{id}/review',
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        details: { fields: [{ field: 'comment', rule: 'maxLength', message: 'server text' }] },
      }),
    );
    const dialog = await openReturn(user);

    await replaceText(user, dialog.getByRole('textbox'), 'Fix the risks.');
    await user.click(dialog.getByRole('button', { name: 'Return' }));

    expect(await dialog.findByText('Comment is too long.')).toBeVisible();
    expect(dialog.queryByText(/server text/)).not.toBeInTheDocument();
  });
});

describe('refusals of the review', () => {
  it('NOT_IN_REVIEW: closes the modal, shows its text and reads the screen again', async () => {
    const user = setupUser();
    const view = await open();
    const dialog = await openApprove(user);
    // Someone withdrew it meanwhile.
    view.api.state.screens = view.api.state.screens.map((s) =>
      s.id === 12 ? { ...s, documentationStatus: 'IN_PROGRESS' as const } : s,
    );

    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    expect(
      await screen.findByText('This screen is no longer in review. Reload to see its status.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Submit for review' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(view.api.callsTo('GET /screens/{id}').length).toBeGreaterThanOrEqual(2);
  });

  it('shows "This screen doesn\'t exist" when it was deleted meanwhile', async () => {
    const user = setupUser();
    const view = await open();
    const dialog = await openApprove(user);
    view.api.state.screens = view.api.state.screens.filter((s) => s.id !== 12);

    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText("This screen doesn't exist")).toBeInTheDocument();
  });

  it('APPLICATION_ARCHIVED: shows its text in the modal and keeps it open', async () => {
    const user = setupUser();
    const view = await open();
    const dialog = await openApprove(user);
    view.apps.state.applications = view.apps.state.applications.map((a) => ({
      ...a,
      status: 'ARCHIVED' as const,
    }));

    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    expect(
      await dialog.findByText(
        "This application is archived, so its documentation can't be changed.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(stored(view)?.documentationStatus).toBe('IN_REVIEW');
  });

  it('shows the catalog text of any other refusal in the modal, never the server text', async () => {
    const user = setupUser();
    const view = await open();
    view.api.failNext(
      'POST /screens/{id}/review',
      new ApiError({ status: 403, code: 'FORBIDDEN' }),
    );
    const dialog = await openApprove(user);

    await user.click(dialog.getByRole('button', { name: 'Approve' }));

    expect(await dialog.findByText("Your role doesn't allow this action.")).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });
});

describe('disabled cases', () => {
  it('disables Approve and Return, with the reason, when the application is archived', async () => {
    await open('ADMINISTRATOR', { archived: true });

    for (const name of ['Approve', 'Return']) {
      const control = screen.getByRole('button', { name });
      expect(control).toBeDisabled();
      expect(control).toHaveAttribute('title', 'Read-only: the application is archived.');
    }
  });

  it('disables them while the browser is offline', async () => {
    await open();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Return' })).toHaveAttribute(
      'title',
      "You're offline. Changes can't be saved until the connection is back.",
    );
  });

  it('disables the decision in an open modal when the connection is lost, with the reason', async () => {
    const user = setupUser();
    const view = await open();
    const dialog = await openApprove(user);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(dialog.getByRole('button', { name: 'Approve' })).toBeDisabled();
    });
    expect(
      dialog.getByText("You're offline. Changes can't be saved until the connection is back."),
    ).toBeVisible();
    expect(reviewCalls(view)).toHaveLength(0);
  });

  it('cannot be closed, and sends once, while the decision is in flight', async () => {
    const user = setupUser();
    const view = await open();
    const hold = view.api.hold((call) => call.path === '/screens/{id}/review');
    const dialog = await openApprove(user);

    await user.click(dialog.getByRole('button', { name: 'Approve' }));
    await user.click(dialog.getByRole('button', { name: 'Approve' }));
    await user.keyboard('{Escape}');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(dialog.getByRole('button', { name: 'Approve' })).toHaveAttribute('aria-busy', 'true');
    hold.release();

    expect(await screen.findByText('Detalle approved.')).toBeInTheDocument();
    expect(reviewCalls(view)).toHaveLength(1);
  });
});

describe('focus and keyboard of the modals', () => {
  it('Esc closes the modal and returns the focus to the button that opened it', async () => {
    const user = setupUser();
    await open();
    await openApprove(user);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveFocus();
  });

  it('Cancel closes it and returns the focus to the button that opened it', async () => {
    const user = setupUser();
    const view = await open();
    const dialog = await openReturn(user);

    await user.click(dialog.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return' })).toHaveFocus();
    expect(reviewCalls(view)).toHaveLength(0);
  });

  it('the close button of the header closes it too', async () => {
    const user = setupUser();
    await open();
    const dialog = await openReturn(user);

    await user.click(dialog.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return' })).toHaveFocus();
  });

  it('keeps Tab inside the modal, in both directions', async () => {
    const user = setupUser();
    await open();
    const dialog = await openReturn(user);
    const field = dialog.getByRole('textbox');
    const cancel = dialog.getByRole('button', { name: 'Cancel' });
    const submit = dialog.getByRole('button', { name: 'Return' });
    const close = dialog.getByRole('button', { name: 'Close' });

    expect(field).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(submit).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(submit).toHaveFocus();
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(submit).toHaveFocus();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('sends the decision with the keyboard: Enter on the button', async () => {
    const user = setupUser();
    const view = await open();
    const dialog = await openApprove(user);

    dialog.getByRole('button', { name: 'Approve' }).focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Detalle approved.')).toBeInTheDocument();
    expect(reviewCalls(view)).toHaveLength(1);
  });

  it('a new modal starts empty: what was typed before Cancel is not kept', async () => {
    const user = setupUser();
    await open();
    const first = await openReturn(user);
    await replaceText(user, first.getByRole('textbox'), 'Half written');
    await user.click(first.getByRole('button', { name: 'Cancel' }));

    const second = await openReturn(user);

    expect(second.getByRole('textbox')).toHaveValue('');
  });
});
