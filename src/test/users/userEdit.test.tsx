// Edit user modal (S-04, S-44): opening from the row menu (GET with the ETag), the PUT with If-Match and the exact
// body, the 412 that keeps what was typed and offers to reload, each error in its place, and the administrator editing
// themselves (a new name only updates the top bar; a new password ends the session and the sign-in page says why).
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { SELF_ID } from '../helpers/fakeUsersApi';
import { renderUsers } from '../helpers/renderUsers';
import { setupUser, type User } from '../helpers/setupUser';

async function openEdit(user: User, rowName: string) {
  const row = (await screen.findByRole('rowheader', { name: new RegExp(`^${rowName}`) })).closest(
    'tr',
  ) as HTMLElement;
  await user.click(within(row).getByRole('button', { name: `Actions for ${rowName}` }));
  await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit user' });
  const scope = within(dialog);
  await waitFor(() => {
    expect(scope.getByLabelText(/^Full name/)).toBeEnabled();
  });
  return scope;
}

async function replace(user: User, field: HTMLElement, text: string) {
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
}

describe('Edit user modal', () => {
  it('reads the user, shows the form with the frame texts and focuses the name', async () => {
    const user = setupUser();
    const { api } = await renderUsers();
    const dialog = await openEdit(user, 'Sample Developer A');

    expect(api.callsTo('GET /users/{id}')[0]?.options.path).toEqual({ id: 3 });
    expect(dialog.getByLabelText<HTMLInputElement>(/^Full name/).value).toBe('Sample Developer A');
    expect(dialog.getByLabelText<HTMLInputElement>(/^Email/).value).toBe('dev.a@example.com');
    expect(dialog.getByLabelText<HTMLInputElement>('New password').value).toBe('');
    expect(dialog.getByLabelText('New password')).toHaveAttribute(
      'placeholder',
      'Leave empty to keep the current password',
    );
    expect(
      dialog.getByText('Changing it signs the user out of open sessions.'),
    ).toBeInTheDocument();
    expect(dialog.getByText('Role and status are changed from the row menu.')).toBeInTheDocument();
    expect(screen.getByText('Last updated 2026-10-03 11:20')).toBeInTheDocument();
    expect(dialog.getByLabelText(/^Full name/)).toHaveFocus();
  });

  it('saves with If-Match and without a password when none was typed', async () => {
    const user = setupUser();
    const { api } = await renderUsers();
    const dialog = await openEdit(user, 'Sample Developer A');
    await replace(user, dialog.getByLabelText(/^Full name/), 'Developer Alpha');

    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Developer Alpha saved.')).toBeInTheDocument();
    const put = api.callsTo('PUT /users/{id}')[0];
    expect(put?.options.ifMatch).toBe('W/"1"');
    expect(put?.options.path).toEqual({ id: 3 });
    expect(put?.options.body).toEqual({
      name: 'Developer Alpha',
      email: 'dev.a@example.com',
      status: 'ACTIVE',
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('rowheader', { name: 'Developer Alpha' })).toBeInTheDocument();
  });

  it('sends the new password only when one was typed, and the server revokes that user', async () => {
    const user = setupUser();
    const { api } = await renderUsers();
    const dialog = await openEdit(user, 'Sample Developer A');
    await user.click(dialog.getByLabelText('New password'));
    await user.paste('Another-pass-2026');

    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(api.callsTo('PUT /users/{id}')).toHaveLength(1);
    });
    expect(api.callsTo('PUT /users/{id}')[0]?.options.body).toMatchObject({
      password: 'Another-pass-2026',
    });
    expect(api.state.revoked).toEqual([3]);
  });

  it('"Generate" fills the new password with one that meets the policy, shows it and sends it with Save', async () => {
    const user = setupUser();
    const { api } = await renderUsers();
    const dialog = await openEdit(user, 'Sample Developer A');
    const field = dialog.getByLabelText<HTMLInputElement>('New password');
    expect(field).toHaveAttribute('type', 'password');

    await user.click(dialog.getByRole('button', { name: 'Generate' }));

    // It is shown as text, so the administrator can read it and pass it on.
    expect(field).toHaveAttribute('type', 'text');
    expect(field.value).toMatch(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{16}$/);
    const first = field.value;
    await user.click(dialog.getByRole('button', { name: 'Generate' }));
    expect(field.value).not.toBe(first);
    expect(field).toHaveAttribute('type', 'text');

    await user.click(dialog.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(api.callsTo('PUT /users/{id}')).toHaveLength(1);
    });
    expect(api.callsTo('PUT /users/{id}')[0]?.options.body).toMatchObject({
      password: field.value,
    });
  });

  it('has a save button that says just "Save", and a Generate button only for the password', async () => {
    const user = setupUser();
    await renderUsers();
    const dialog = await openEdit(user, 'Sample Developer A');

    expect(dialog.getByRole('button', { name: 'Save changes' })).toHaveTextContent(/^Save$/);
    expect(dialog.getAllByRole('button', { name: 'Generate' })).toHaveLength(1);
    expect(dialog.getByRole('button', { name: 'Generate' }).querySelector('svg')).toHaveClass(
      'lucide-key-round',
    );
  });

  it('checks the form before sending and marks the first invalid field', async () => {
    const user = setupUser();
    const { api } = await renderUsers();
    const dialog = await openEdit(user, 'Sample Developer A');
    await replace(user, dialog.getByLabelText(/^Full name/), '   ');
    await user.click(dialog.getByLabelText('New password'));
    await user.paste('short1');

    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    expect(await dialog.findByText('Full name is required.')).toBeInTheDocument();
    expect(dialog.getByText('New password is too short.')).toBeInTheDocument();
    expect(dialog.getByLabelText(/^Full name/)).toHaveFocus();
    expect(api.callsTo('PUT /users/{id}')).toHaveLength(0);
  });

  it('EMAIL_TAKEN goes under the email and keeps the rest', async () => {
    const user = setupUser();
    const { api } = await renderUsers();
    const dialog = await openEdit(user, 'Sample Developer A');
    await replace(user, dialog.getByLabelText(/^Email/), 'reader@example.com');

    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    expect(await dialog.findByText('A user with this email already exists.')).toBeInTheDocument();
    expect(dialog.getByLabelText(/^Email/)).toHaveAccessibleDescription(
      'A user with this email already exists.',
    );
    expect(dialog.getByLabelText(/^Email/)).toHaveFocus();
    expect(api.callsTo('PUT /users/{id}')).toHaveLength(1);
  });

  it('VALIDATION_ERROR from the server marks the field it names with the catalog text', async () => {
    const user = setupUser();
    const { api } = await renderUsers();
    const dialog = await openEdit(user, 'Sample Developer A');
    api.failNext(
      'PUT /users/{id}',
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        details: { fields: [{ field: 'password', rule: 'pattern', message: 'server text' }] },
      }),
    );

    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    expect(await dialog.findByText("New password isn't in a valid format.")).toBeInTheDocument();
    expect(dialog.queryByText('server text')).not.toBeInTheDocument();
  });

  it('RESERVED_ACCOUNT and other refusals go in the banner of the form', async () => {
    const user = setupUser();
    const { api } = await renderUsers();
    const dialog = await openEdit(user, 'Sample Developer A');
    api.failNext('PUT /users/{id}', new ApiError({ status: 422, code: 'RESERVED_ACCOUNT' }));

    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    expect(
      await dialog.findByText("This is a system account and can't be changed."),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  describe('412 (S-44)', () => {
    async function conflict() {
      const user = setupUser();
      const view = await renderUsers();
      const dialog = await openEdit(user, 'Sample Developer A');
      await replace(user, dialog.getByLabelText(/^Full name/), 'My version');
      // Someone else saves meanwhile: the ETag of the user moves.
      view.api.state.versions.set(3, 9);
      view.api.state.users = view.api.state.users.map((u) =>
        u.id === 3 ? { ...u, name: 'Their version' } : u,
      );
      await user.click(dialog.getByRole('button', { name: 'Save changes' }));
      await dialog.findByRole('button', { name: 'Reload' });
      return { user, dialog, ...view };
    }

    it('keeps what was typed, disables Save and offers to reload', async () => {
      const { dialog } = await conflict();

      expect(
        dialog.getByText(
          'Someone else saved changes to this user after you opened it. Reload to see their version. Your changes will be lost, so copy anything you need first.',
        ),
      ).toBeInTheDocument();
      expect(dialog.getByLabelText<HTMLInputElement>(/^Full name/).value).toBe('My version');
      expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled();
      expect(dialog.getByRole('button', { name: 'Keep my changes visible' })).toBeInTheDocument();
      expect(dialog.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    });

    it('"Keep my changes visible" hides the banner and leaves the sentence next to Save', async () => {
      const { user, dialog } = await conflict();

      await user.click(dialog.getByRole('button', { name: 'Keep my changes visible' }));

      expect(dialog.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
      expect(dialog.getByLabelText<HTMLInputElement>(/^Full name/).value).toBe('My version');
      expect(dialog.getByRole('button', { name: 'Save changes' })).toBeDisabled();
      expect(dialog.getByRole('button', { name: 'Save changes' })).toHaveAccessibleDescription(
        'Someone else saved changes to this user after you opened it. Reload to see their version.',
      );
    });

    it('"Reload" reads the other version into the form and Save works again', async () => {
      const { user, dialog, api } = await conflict();
      const modal = () => within(screen.getByRole('dialog', { name: 'Edit user' }));

      await user.click(dialog.getByRole('button', { name: 'Reload' }));

      // The form is replaced by a fresh one once the new copy arrives.
      await waitFor(() => {
        expect(modal().getByLabelText<HTMLInputElement>(/^Full name/).value).toBe('Their version');
      });
      expect(api.callsTo('GET /users/{id}')).toHaveLength(2);
      expect(modal().getByRole('button', { name: 'Save changes' })).toBeEnabled();
      await user.click(modal().getByRole('button', { name: 'Save changes' }));
      expect(await screen.findByText('Their version saved.')).toBeInTheDocument();
      expect(api.callsTo('PUT /users/{id}').at(-1)?.options.ifMatch).toBe('W/"9"');
    });
  });

  it('shows the catalog text with a retry when the user cannot be read', async () => {
    const user = setupUser();
    const { api } = await renderUsers();
    await screen.findByRole('rowheader', { name: 'Sample Admin' });
    api.failNext('GET /users/{id}', new ApiError({ status: 404, code: 'NOT_FOUND' }));
    const row = screen
      .getByRole('rowheader', { name: 'Sample Reader' })
      .closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Actions for Sample Reader' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));

    const dialog = within(await screen.findByRole('dialog', { name: 'Edit user' }));
    expect(
      await dialog.findByText("This user doesn't exist. It may have been deleted."),
    ).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText(/^Full name/)).toBeInTheDocument();
  });

  it('closes with Escape and returns the focus to the row menu button', async () => {
    const user = setupUser();
    await renderUsers();
    await openEdit(user, 'Sample Reader');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for Sample Reader' })).toHaveFocus();
  });

  describe('the administrator editing themselves', () => {
    it('says that a new password signs them out', async () => {
      const user = setupUser();
      await renderUsers();
      const dialog = await openEdit(user, 'Ana Mora');
      expect(
        dialog.getByText("Changing it signs you out: you'll need to sign in again."),
      ).toBeInTheDocument();
    });

    it('a new name updates the top bar and the list, and the session goes on', async () => {
      const user = setupUser();
      const { manager, api } = await renderUsers();
      const dialog = await openEdit(user, 'Ana Mora');
      await replace(user, dialog.getByLabelText(/^Full name/), 'Ana Mora Ruiz');

      await user.click(dialog.getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('Ana Mora Ruiz saved.')).toBeInTheDocument();
      expect(within(screen.getByRole('banner')).getByText('Ana Mora Ruiz')).toBeInTheDocument();
      expect(manager.getSnapshot()).toMatchObject({ status: 'authenticated' });
      expect(manager.getSnapshot().user?.name).toBe('Ana Mora Ruiz');
      expect(api.state.revoked).toEqual([]);
      expect(await screen.findByRole('rowheader', { name: /^Ana Mora Ruiz/ })).toBeInTheDocument();
    });

    it('a new password ends the session at once and the sign-in page says why', async () => {
      const user = setupUser();
      const { manager, api, router } = await renderUsers();
      const dialog = await openEdit(user, 'Ana Mora');
      await user.click(dialog.getByLabelText('New password'));
      await user.paste('Brand-new-pass-2026');

      await user.click(dialog.getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
      expect(
        screen.getByText('Your password changed. Sign in again to continue.'),
      ).toBeInTheDocument();
      expect(manager.getSnapshot()).toMatchObject({
        status: 'anonymous',
        endReason: 'logout',
        endNotice: 'PASSWORD_CHANGED',
      });
      expect(api.state.revoked).toEqual([SELF_ID]);
      expect(router.state.location.pathname).toBe('/login');
      expect(screen.queryByText('Session ended')).not.toBeInTheDocument();
    });
  });
});
