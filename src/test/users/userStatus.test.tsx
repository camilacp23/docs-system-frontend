// Deactivate (S-06, S-06b) and reactivate: the confirmation that says the sessions end, the refusals of the API
// (LAST_ACTIVE_ADMIN, CANNOT_DEACTIVATE_SELF) with only "Close" left, the administrator who cannot deactivate
// themselves (disabled with the reason, and the 422 still handled), reactivation with every field and If-Match,
// and the writes disabled while offline.
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { SELF_ID } from '../helpers/fakeUsersApi';
import { renderUsers, sampleUsers } from '../helpers/renderUsers';
import { setupSettledUser, type User } from '../helpers/setupUser';

afterEach(() => {
  vi.restoreAllMocks();
});

async function openMenu(user: User, rowName: string) {
  const row = (await screen.findByRole('rowheader', { name: new RegExp(`^${rowName}`) })).closest(
    'tr',
  ) as HTMLElement;
  await user.click(within(row).getByRole('button', { name: `Actions for ${rowName}` }));
}

async function openDeactivate(user: User, rowName: string) {
  await openMenu(user, rowName);
  await user.click(await screen.findByRole('menuitem', { name: 'Deactivate' }));
  return within(await screen.findByRole('dialog', { name: 'Deactivate this user?' }));
}

describe('Deactivate user', () => {
  it('asks first, with the text of the frame, and Cancel changes nothing', async () => {
    const user = setupSettledUser();
    const { api } = await renderUsers();
    const dialog = await openDeactivate(user, 'Sample Developer A');

    expect(
      dialog.getByText(
        'Sample Developer A will no longer be able to sign in, and their open sessions will end. Their documentation, comments and audit history are kept. You can reactivate them later.',
      ),
    ).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.callsTo('DELETE /users/{id}')).toHaveLength(0);
  });

  it('closes with Escape and returns the focus to the row menu button', async () => {
    const user = setupSettledUser();
    await renderUsers();
    await openDeactivate(user, 'Sample Developer A');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for Sample Developer A' })).toHaveFocus();
  });

  it('deactivates, says so, revokes the sessions and the row leaves the active list', async () => {
    const user = setupSettledUser();
    const { api } = await renderUsers();
    const dialog = await openDeactivate(user, 'Sample Developer A');

    await user.click(dialog.getByRole('button', { name: 'Deactivate user' }));

    expect(await screen.findByText('Sample Developer A deactivated.')).toBeInTheDocument();
    expect(api.callsTo('DELETE /users/{id}')[0]?.options.path).toEqual({ id: 3 });
    expect(api.state.revoked).toEqual([3]);
    await waitFor(() => {
      expect(
        screen.queryByRole('rowheader', { name: 'Sample Developer A' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('LAST_ACTIVE_ADMIN: the banner says why and only "Close" is left (S-06b)', async () => {
    const user = setupSettledUser();
    const users = sampleUsers().map((u) =>
      u.id === SELF_ID ? { ...u, role: 'DEVELOPER' as const } : u,
    );
    await renderUsers({ users });
    const dialog = await openDeactivate(user, 'Sample Admin');

    await user.click(dialog.getByRole('button', { name: 'Deactivate user' }));

    expect(
      await dialog.findByText(
        'There must be at least one active administrator. Promote another user first.',
      ),
    ).toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: 'Deactivate user' })).not.toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    // The X of the header and the "Close" of the footer (S-06b).
    const closers = dialog.getAllByRole('button', { name: 'Close' });
    expect(closers).toHaveLength(2);
    await user.click(closers[1] as HTMLElement);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('CANNOT_DEACTIVATE_SELF from the API is shown the same way', async () => {
    const user = setupSettledUser();
    // The API believes the signed-in user is user 3: it refuses to deactivate them.
    await renderUsers({
      prepare: (api) => {
        api.state.selfId = 3;
      },
    });
    const dialog = await openDeactivate(user, 'Sample Developer A');

    await user.click(dialog.getByRole('button', { name: 'Deactivate user' }));

    expect(await dialog.findByText("You can't deactivate your own account.")).toBeInTheDocument();
    expect(dialog.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
  });

  it('a failure that is not a refusal keeps the button so it can be tried again', async () => {
    const user = setupSettledUser();
    const { api } = await renderUsers();
    const dialog = await openDeactivate(user, 'Sample Developer A');
    api.failNext('DELETE /users/{id}', new ApiError({ status: 0, code: 'NETWORK_ERROR' }));

    await user.click(dialog.getByRole('button', { name: 'Deactivate user' }));

    expect(
      await dialog.findByText(
        "You're offline. Changes can't be saved until the connection is back.",
      ),
    ).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Deactivate user' }));
    expect(await screen.findByText('Sample Developer A deactivated.')).toBeInTheDocument();
  });

  describe('the administrator themselves', () => {
    it('cannot be deactivated: the item is disabled with the reason and does nothing', async () => {
      const user = setupSettledUser();
      const { api } = await renderUsers();
      await openMenu(user, 'Ana Mora');

      const item = await screen.findByRole('menuitem', { name: 'Deactivate' });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveAttribute('title', "You can't deactivate your own account.");
      await user.click(item);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(api.callsTo('DELETE /users/{id}')).toHaveLength(0);
    });

    it('can still change their own name and role from the menu', async () => {
      const user = setupSettledUser();
      await renderUsers();
      await openMenu(user, 'Ana Mora');
      expect(await screen.findByRole('menuitem', { name: 'Edit' })).not.toHaveAttribute(
        'aria-disabled',
      );
      expect(screen.getByRole('menuitem', { name: 'Change role' })).not.toHaveAttribute(
        'aria-disabled',
      );
    });
  });
});

describe('Reactivate user', () => {
  async function reactivateFormer(user: User) {
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Status' }), 'INACTIVE');
    await screen.findByRole('rowheader', { name: 'Former Developer' });
    await openMenu(user, 'Former Developer');
    await user.click(await screen.findByRole('menuitem', { name: 'Reactivate' }));
  }

  it('reads the user and sends every field back with If-Match, with no confirmation', async () => {
    const user = setupSettledUser();
    const { api } = await renderUsers();

    await reactivateFormer(user);

    expect(await screen.findByText('Former Developer reactivated.')).toBeInTheDocument();
    const put = api.callsTo('PUT /users/{id}')[0];
    expect(put?.options.ifMatch).toBe('W/"1"');
    expect(put?.options.body).toEqual({
      name: 'Former Developer',
      email: 'former.dev@example.com',
      status: 'ACTIVE',
    });
    expect(api.callsTo('GET /users/{id}')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('rowheader', { name: 'Former Developer' })).not.toBeInTheDocument();
    });
  });

  it('shows the catalog text in a warning toast when it fails and reads the list again', async () => {
    const user = setupSettledUser();
    const { api } = await renderUsers();
    api.failNext('PUT /users/{id}', new ApiError({ status: 412, code: 'PRECONDITION_FAILED' }));
    const before = api.callsTo('GET /users').length;

    await reactivateFormer(user);

    expect(
      await screen.findByText(
        'Someone else saved changes to this user after you opened it. Reload to see their version.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(api.callsTo('GET /users').length).toBeGreaterThan(before + 1);
    });
  });

  it('an active user shows Deactivate and an inactive one shows Reactivate, never both', async () => {
    const user = setupSettledUser();
    await renderUsers();
    await openMenu(user, 'Sample Reader');
    expect(await screen.findByRole('menuitem', { name: 'Deactivate' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Reactivate' })).not.toBeInTheDocument();
  });
});

describe('writes while offline', () => {
  it('disables every item of the row menu with the reason', async () => {
    const user = setupSettledUser();
    await renderUsers();
    await openMenu(user, 'Sample Developer A');
    await user.keyboard('{Escape}');

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await openMenu(user, 'Sample Developer A');

    for (const name of ['Edit', 'Change role', 'Deactivate']) {
      const item = await screen.findByRole('menuitem', { name });
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveAttribute(
        'title',
        "You're offline. Changes can't be saved until the connection is back.",
      );
    }
  });
});
