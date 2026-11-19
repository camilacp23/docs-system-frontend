// New user modal (S-03): opening and focus, the password policy and the generator, the POST body, each error of
// Table 46 in its place (EMAIL_TAKEN under the email, VALIDATION_ERROR by field, the rest in the banner), the
// success message, offline, and that the temporary password is never kept after the modal closes.
import {
  act,
  screen,
  waitFor,
  within,
  type BoundFunctions,
  type queries,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { renderUsers } from '../helpers/renderUsers';
import { setupUser, type User } from '../helpers/setupUser';

const GOOD_PASSWORD = 'Clave-2026-xyz';

async function openModal(user: User) {
  await screen.findByRole('rowheader', { name: 'Sample Admin' });
  await user.click(screen.getByRole('button', { name: 'New user' }));
  return within(await screen.findByRole('dialog', { name: 'New user' }));
}

async function fill(user: User, field: HTMLElement, text: string) {
  await user.click(field);
  await user.paste(text);
}

async function fillAll(
  user: User,
  dialog: BoundFunctions<typeof queries>,
  values: { name?: string; email?: string; role?: string; password?: string } = {},
) {
  await fill(user, dialog.getByLabelText(/^Full name/), values.name ?? 'Marta Rios');
  await fill(user, dialog.getByLabelText(/^Email/), values.email ?? 'marta.rios@dept.local');
  await user.click(dialog.getByRole('radio', { name: new RegExp(values.role ?? 'Developer') }));
  await fill(user, dialog.getByLabelText(/^Temporary password/), values.password ?? GOOD_PASSWORD);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('New user modal', () => {
  it('opens over the list with the name focused and Cancel returns the focus to the button', async () => {
    const user = setupUser();
    const { router } = await renderUsers();
    const dialog = await openModal(user);

    expect(dialog.getByLabelText(/^Full name/)).toHaveFocus();
    expect(router.state.location.search).toBe('?new=1');
    expect(dialog.getByText('0/120')).toBeInTheDocument();
    expect(dialog.getByRole('radiogroup', { name: /^Role/ })).toBeInTheDocument();
    expect(dialog.getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual([
      'ADMINISTRATOR',
      'DEVELOPER',
      'READER',
    ]);
    expect(
      dialog.getByText('Manages users and applications; approves documentation.'),
    ).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('button', { name: 'New user' })).toHaveFocus();
  });

  it('closes with Escape and with the close button', async () => {
    const user = setupUser();
    await renderUsers();
    await openModal(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await openModal(user);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the focus inside the modal with Tab and Shift+Tab', async () => {
    const user = setupUser();
    await renderUsers();
    await openModal(user);
    const dialog = screen.getByRole('dialog');

    await user.tab({ shift: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    for (let i = 0; i < 12; i++) await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('checks the policy as the password is typed and checks the form on submit without calling the API', async () => {
    const user = setupUser();
    const { api } = await renderUsers();
    const dialog = await openModal(user);
    const policy = dialog.getByRole('list', { name: 'Password policy' });
    expect(within(policy).getByText('At least 12 characters').closest('li')).toHaveTextContent(
      'not met yet',
    );

    await fill(user, dialog.getByLabelText(/^Temporary password/), 'abcdefghijkl');
    expect(within(policy).getByText('At least 12 characters').closest('li')).toHaveTextContent(
      '(met)',
    );
    expect(within(policy).getByText('Letters and digits').closest('li')).toHaveTextContent(
      'not met yet',
    );

    await user.click(dialog.getByRole('button', { name: 'Create user' }));

    expect(await dialog.findByText('Full name is required.')).toBeInTheDocument();
    expect(dialog.getByText('Email is required.')).toBeInTheDocument();
    expect(dialog.getByText('Role is required.')).toBeInTheDocument();
    expect(dialog.getByText("Temporary password isn't in a valid format.")).toBeInTheDocument();
    expect(dialog.getByLabelText(/^Full name/)).toHaveFocus();
    expect(dialog.getByLabelText(/^Full name/)).toHaveAttribute('aria-invalid', 'true');
    expect(api.callsTo('POST /users')).toHaveLength(0);
  });

  it('draws the same key icon on "Generate" here and in the edit modal', async () => {
    const user = setupUser();
    await renderUsers();
    const dialog = await openModal(user);

    const icon = dialog.getByRole('button', { name: 'Generate' }).querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveClass('lucide-key-round');
  });

  it('generates a password that meets the policy and shows it as typed', async () => {
    const user = setupUser();
    await renderUsers();
    const dialog = await openModal(user);

    await user.click(dialog.getByRole('button', { name: 'Generate' }));

    const field = dialog.getByLabelText<HTMLInputElement>(/^Temporary password/);
    expect(field.value).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(field).not.toHaveAttribute('type', 'password');
    const policy = dialog.getByRole('list', { name: 'Password policy' });
    expect(within(policy).getByText('At least 12 characters').closest('li')).toHaveTextContent(
      '(met)',
    );
    expect(within(policy).getByText('Letters and digits').closest('li')).toHaveTextContent('(met)');
  });

  it('creates the user with the complete body, says so, closes and shows the new row', async () => {
    const user = setupUser();
    const { api, router } = await renderUsers();
    const dialog = await openModal(user);
    await fillAll(user, dialog, { name: '  Marta Rios ', email: 'Marta.Rios@dept.local' });

    await user.click(dialog.getByRole('button', { name: 'Create user' }));

    expect(await screen.findByText('Marta Rios created.')).toBeInTheDocument();
    expect(api.callsTo('POST /users')[0]?.options.body).toEqual({
      name: 'Marta Rios',
      email: 'Marta.Rios@dept.local',
      password: GOOD_PASSWORD,
      role: 'DEVELOPER',
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(router.state.location.search).toBe('');
    expect(await screen.findByRole('rowheader', { name: 'Marta Rios' })).toBeInTheDocument();
  });

  it('never keeps the temporary password: not in the URL, not in storage, not after reopening', async () => {
    const user = setupUser();
    const { router } = await renderUsers();
    const dialog = await openModal(user);
    await user.click(dialog.getByRole('button', { name: 'Generate' }));
    const generated = dialog.getByLabelText<HTMLInputElement>(/^Temporary password/).value;

    expect(router.state.location.search).not.toContain(generated);
    expect(JSON.stringify({ ...localStorage })).not.toContain(generated);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(generated);

    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    const reopened = await openModal(user);
    expect(reopened.getByLabelText<HTMLInputElement>(/^Temporary password/).value).toBe('');
    expect(document.body.textContent).not.toContain(generated);
    expect(router.state.location.search).not.toContain(generated);
  });

  it('EMAIL_TAKEN goes under the email and keeps what was typed', async () => {
    const user = setupUser();
    const { api } = await renderUsers();
    const dialog = await openModal(user);
    await fillAll(user, dialog, { email: 'dev.a@example.com' });

    await user.click(dialog.getByRole('button', { name: 'Create user' }));

    const email = dialog.getByLabelText(/^Email/);
    expect(await dialog.findByText('A user with this email already exists.')).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('A user with this email already exists.');
    expect(email).toHaveFocus();
    expect(dialog.getByLabelText<HTMLInputElement>(/^Full name/).value).toBe('Marta Rios');
    expect(api.callsTo('POST /users')).toHaveLength(1);
  });

  it('VALIDATION_ERROR from the server marks each field it names, with the catalog text by rule', async () => {
    const user = setupUser();
    await renderUsers({
      prepare: (api) => {
        api.failNext(
          'POST /users',
          new ApiError({
            status: 400,
            code: 'VALIDATION_ERROR',
            details: {
              fields: [
                { field: 'name', rule: 'maxLength', message: 'server text' },
                { field: 'password', rule: 'pattern', message: 'server text' },
              ],
            },
          }),
        );
      },
    });
    const dialog = await openModal(user);
    await fillAll(user, dialog);

    await user.click(dialog.getByRole('button', { name: 'Create user' }));

    expect(await dialog.findByText('Full name is too long.')).toBeInTheDocument();
    expect(dialog.getByText("Temporary password isn't in a valid format.")).toBeInTheDocument();
    expect(dialog.queryByText('server text')).not.toBeInTheDocument();
  });

  it.each([
    ['RESERVED_ACCOUNT', 422, "This is a system account and can't be changed."],
    [
      'LAST_ACTIVE_ADMIN',
      422,
      'There must be at least one active administrator. Promote another user first.',
    ],
    ['INTERNAL_ERROR', 500, 'Something went wrong on our side. Try again in a moment.'],
  ])('%s is shown in the banner of the form', async (code, status, text) => {
    const user = setupUser();
    await renderUsers({
      prepare: (api) => {
        api.failNext('POST /users', new ApiError({ status, code }));
      },
    });
    const dialog = await openModal(user);
    await fillAll(user, dialog);

    await user.click(dialog.getByRole('button', { name: 'Create user' }));

    expect(await dialog.findByText(text)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('a network failure is shown with the offline text and the modal stays open', async () => {
    const user = setupUser();
    await renderUsers({
      prepare: (api) => {
        api.failNext('POST /users', new ApiError({ status: 0, code: 'NETWORK_ERROR' }));
      },
    });
    const dialog = await openModal(user);
    await fillAll(user, dialog);

    await user.click(dialog.getByRole('button', { name: 'Create user' }));

    expect(
      await dialog.findByText(
        "You're offline. Changes can't be saved until the connection is back.",
      ),
    ).toBeInTheDocument();
  });

  it('disables creating, with the reason, while the browser is offline', async () => {
    const user = setupUser();
    await renderUsers();
    const dialog = await openModal(user);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(dialog.getByRole('button', { name: 'Create user' })).toBeDisabled();
    });
    expect(dialog.getAllByText(/You're offline/).length).toBeGreaterThan(0);
  });
});
