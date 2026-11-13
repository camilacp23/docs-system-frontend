// Change role modal (S-05): the radio cards, the info line of the frame, the PUT, the refusals, and the administrator
// changing THEIR OWN role: the modal warns first, and after the 200 the session ends at once (the server revoked it)
// and the sign-in page says why. Also the keyboard path through the row menu.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { SELF_ID, makeUser } from '../helpers/fakeUsersApi';
import { renderUsers, sampleUsers } from '../helpers/renderUsers';
import { setupUser, type User } from '../helpers/setupUser';

async function openRole(user: User, rowName: string) {
  const row = (await screen.findByRole('rowheader', { name: new RegExp(`^${rowName}`) })).closest(
    'tr',
  ) as HTMLElement;
  await user.click(within(row).getByRole('button', { name: `Actions for ${rowName}` }));
  await user.click(await screen.findByRole('menuitem', { name: 'Change role' }));
  return within(await screen.findByRole('dialog', { name: 'Change role' }));
}

describe('Change role modal', () => {
  it('shows the three roles with the current one chosen and the line of the frame', async () => {
    const user = setupUser();
    await renderUsers();
    const dialog = await openRole(user, 'Sample Developer A');

    expect(screen.getByText('Sample Developer A · currently Developer')).toBeInTheDocument();
    expect(
      dialog.getAllByRole('radio').map((radio) => (radio as HTMLInputElement).checked),
    ).toEqual([false, true, false]);
    expect(
      dialog.getByText(
        'The new role applies immediately and Sample Developer A is signed out of open sessions.',
      ),
    ).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Change role' })).toBeDisabled();
  });

  it('changes the role, says so and shows it in the list', async () => {
    const user = setupUser();
    const { api } = await renderUsers();
    const dialog = await openRole(user, 'Sample Developer A');

    await user.click(dialog.getByRole('radio', { name: /Reader/ }));
    expect(dialog.getByRole('button', { name: 'Change role' })).toBeEnabled();
    await user.click(dialog.getByRole('button', { name: 'Change role' }));

    expect(await screen.findByText('Sample Developer A is now Reader.')).toBeInTheDocument();
    expect(api.callsTo('PUT /users/{id}/role')[0]?.options).toMatchObject({
      path: { id: 3 },
      body: { role: 'READER' },
    });
    expect(api.callsTo('PUT /users/{id}/role')[0]?.options.ifMatch).toBeUndefined();
    expect(api.state.revoked).toEqual([3]);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    const row = (await screen.findByRole('rowheader', { name: 'Sample Developer A' })).closest(
      'tr',
    ) as HTMLElement;
    await waitFor(() => {
      expect(within(row).getByText('Reader')).toBeInTheDocument();
    });
  });

  it('LAST_ACTIVE_ADMIN is shown in the banner and the modal stays open', async () => {
    const user = setupUser();
    // The only active administrator is Sample Admin; the signed-in user is listed as a developer.
    const users = sampleUsers().map((u) =>
      u.id === SELF_ID ? { ...u, role: 'DEVELOPER' as const } : u,
    );
    await renderUsers({ users });
    const dialog = await openRole(user, 'Sample Admin');

    await user.click(dialog.getByRole('radio', { name: /Reader/ }));
    await user.click(dialog.getByRole('button', { name: 'Change role' }));

    expect(
      await dialog.findByText(
        'There must be at least one active administrator. Promote another user first.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Change role' })).toBeInTheDocument();
  });

  it.each([
    ['RESERVED_ACCOUNT', 422, "This is a system account and can't be changed."],
    ['NOT_FOUND', 404, "This user doesn't exist. It may have been deleted."],
  ])('%s is shown in the banner', async (code, status, text) => {
    const user = setupUser();
    const { api } = await renderUsers();
    const dialog = await openRole(user, 'Sample Developer A');
    api.failNext('PUT /users/{id}/role', new ApiError({ status, code }));

    await user.click(dialog.getByRole('radio', { name: /Administrator/ }));
    await user.click(dialog.getByRole('button', { name: 'Change role' }));

    expect(await dialog.findByText(text)).toBeInTheDocument();
  });

  it('works from the keyboard: the row menu, the arrows, Enter, and Escape returns the focus', async () => {
    const user = setupUser();
    await renderUsers();
    const trigger = await screen.findByRole('button', { name: 'Actions for Sample Reader' });

    trigger.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Change role' })).toHaveFocus();
    await user.keyboard('{Enter}');

    const dialog = await screen.findByRole('dialog', { name: 'Change role' });
    expect(dialog).toBeInTheDocument();
    await user.tab();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  describe('the administrator changing their own role', () => {
    it('warns before confirming instead of the line of the frame', async () => {
      const user = setupUser();
      await renderUsers();
      const dialog = await openRole(user, 'Ana Mora');

      expect(
        dialog.getByText(
          "You're changing your own role. Your sessions will end and you'll need to sign in again.",
        ),
      ).toBeInTheDocument();
      expect(dialog.queryByText(/is signed out of open sessions/)).not.toBeInTheDocument();
    });

    it('signs out at once after the 200 and the sign-in page says why', async () => {
      const user = setupUser();
      const { api, manager, router } = await renderUsers();
      const dialog = await openRole(user, 'Ana Mora');

      await user.click(dialog.getByRole('radio', { name: /Developer/ }));
      await user.click(dialog.getByRole('button', { name: 'Change role' }));

      expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
      expect(screen.getByText('Your role changed. Sign in again to continue.')).toBeInTheDocument();
      expect(api.state.revoked).toEqual([SELF_ID]);
      expect(manager.getSnapshot()).toMatchObject({
        status: 'anonymous',
        endReason: 'logout',
        endNotice: 'ROLE_CHANGED',
        user: null,
      });
      expect(router.state.location.pathname).toBe('/login');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps the session when the API refuses (the only active administrator)', async () => {
      const user = setupUser();
      const users = [
        makeUser(SELF_ID, 'Ana Mora', { role: 'ADMINISTRATOR' }),
        makeUser(5, 'Sample Reader', { role: 'READER' }),
      ];
      const { manager, api } = await renderUsers({ users });
      const dialog = await openRole(user, 'Ana Mora');

      await user.click(dialog.getByRole('radio', { name: /Reader/ }));
      await user.click(dialog.getByRole('button', { name: 'Change role' }));

      expect(
        await dialog.findByText(
          'There must be at least one active administrator. Promote another user first.',
        ),
      ).toBeInTheDocument();
      expect(manager.getSnapshot().status).toBe('authenticated');
      expect(manager.getSnapshot().endNotice).toBeNull();
      expect(api.state.revoked).toEqual([]);
    });
  });
});
