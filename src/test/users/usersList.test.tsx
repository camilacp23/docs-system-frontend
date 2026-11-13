// User list (S-02, S-02b, S-02c, S-02d): rows, the screen that opens on the active users, search / role / status /
// sort / page reflected in the URL and the request, the reserved account that is never listed, loading, empty and
// error states, "(you)" and the sidebar item.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeUser } from '../helpers/fakeUsersApi';
import { renderUsers, sampleUsers } from '../helpers/renderUsers';
import { setupUser } from '../helpers/setupUser';

const NAMES = (table: HTMLElement) =>
  within(table)
    .getAllByRole('rowheader')
    .map((cell) => cell.textContent.trim());

/** The table once its first load has finished. */
async function table() {
  const grid = await screen.findByRole('table', { name: 'Users' });
  await waitFor(() => {
    expect(grid).toHaveAttribute('aria-busy', 'false');
  });
  return grid;
}

describe('user list', () => {
  it('opens on the active users with name, email, role, status, last sign-in and creation date', async () => {
    const { api } = await renderUsers();
    const grid = await table();

    expect(api.callsTo('GET /users')[0]?.options.query).toEqual({
      page: 1,
      pageSize: 20,
      sort: 'name',
      status: 'ACTIVE',
    });
    expect(NAMES(grid)).toEqual([
      'Ana Mora (you)',
      'Sample Admin',
      'Sample Developer A',
      'Sample Developer B',
      'Sample Reader',
    ]);
    const row = within(grid).getByRole('rowheader', { name: 'Sample Developer A' }).closest('tr');
    expect(within(row as HTMLElement).getByText('dev.a@example.com')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('Developer')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('Active')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('2026-10-05 07:45')).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText('2026-09-22')).toBeInTheDocument();
    const never = within(grid).getByRole('rowheader', { name: 'Sample Developer B' }).closest('tr');
    expect(within(never as HTMLElement).getByText('Never')).toBeInTheDocument();
    expect(screen.getByText('5 active users')).toBeInTheDocument();
  });

  it('never shows the reserved account, and the client does not filter it', async () => {
    const { api } = await renderUsers();
    const grid = await table();
    const user = setupUser();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'ALL');
    await waitFor(() => {
      expect(NAMES(grid)).toHaveLength(6);
    });
    expect(within(grid).queryByText('Integración Jira')).not.toBeInTheDocument();
    // The request carries no filter that hides it: that is the API's job.
    expect(api.callsTo('GET /users').at(-1)?.options.query).not.toHaveProperty('status');
  });

  it('filters by status through the URL and the request', async () => {
    const user = setupUser();
    const { router, api } = await renderUsers();
    const grid = await table();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'INACTIVE');

    await waitFor(() => {
      expect(NAMES(grid)).toEqual(['Former Developer']);
    });
    expect(router.state.location.search).toBe('?status=INACTIVE');
    expect(api.callsTo('GET /users').at(-1)?.options.query).toMatchObject({ status: 'INACTIVE' });
    const row = within(grid).getByRole('rowheader', { name: 'Former Developer' }).closest('tr');
    expect(within(row as HTMLElement).getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('1 inactive user')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'ALL');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?status=ALL');
    });
    expect(await screen.findByText('6 users')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'ACTIVE');
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
  });

  it('filters by role', async () => {
    const user = setupUser();
    const { router } = await renderUsers();
    const grid = await table();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Role' }), 'DEVELOPER');

    await waitFor(() => {
      expect(NAMES(grid)).toEqual(['Sample Developer A', 'Sample Developer B']);
    });
    expect(router.state.location.search).toBe('?role=DEVELOPER');
  });

  it('waits for the user to stop typing before searching by name or email', async () => {
    const user = setupUser();
    const { router, api } = await renderUsers();
    const grid = await table();
    const before = api.callsTo('GET /users').length;

    await user.type(screen.getByRole('searchbox', { name: 'Search by name or email' }), 'dev.');

    await waitFor(() => {
      expect(router.state.location.search).toBe('?q=dev.');
    });
    await waitFor(() => {
      expect(NAMES(grid)).toEqual(['Sample Developer A', 'Sample Developer B']);
    });
    expect(api.callsTo('GET /users').length).toBe(before + 1);
  });

  it('sends the characters of the search as typed (the encoding is the HTTP layer job)', async () => {
    const user = setupUser();
    const { api } = await renderUsers();
    await table();

    await user.type(
      screen.getByRole('searchbox', { name: 'Search by name or email' }),
      "o'brien (x)!",
    );

    await waitFor(() => {
      expect(api.callsTo('GET /users').at(-1)?.options.query).toMatchObject({ q: "o'brien (x)!" });
    });
  });

  it('sorts by the clickable columns and goes back to the first page', async () => {
    const user = setupUser();
    const { router, api } = await renderUsers();
    const grid = await table();

    await user.click(screen.getByRole('button', { name: 'Sort by Name' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?sort=-name');
    });
    await waitFor(() => {
      expect(NAMES(grid)[0]).toBe('Sample Reader');
    });
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    await user.click(screen.getByRole('button', { name: 'Sort by Last sign-in' }));
    await waitFor(() => {
      expect(api.callsTo('GET /users').at(-1)?.options.query).toMatchObject({
        sort: 'lastLoginAt',
      });
    });
    await user.click(screen.getByRole('button', { name: 'Sort by Created' }));
    await waitFor(() => {
      expect(api.callsTo('GET /users').at(-1)?.options.query).toMatchObject({ sort: 'createdAt' });
    });
  });

  it('pages by 20, 50 or 100', async () => {
    const many = Array.from({ length: 45 }, (_, index) =>
      makeUser(100 + index, `User ${String(index).padStart(2, '0')}`),
    );
    const user = setupUser();
    const { router, api } = await renderUsers({ users: [...sampleUsers(), ...many] });
    const grid = await table();
    await waitFor(() => {
      expect(NAMES(grid)).toHaveLength(20);
    });
    expect(screen.getByText('Showing 1–20 of 50')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?page=2');
    });
    await waitFor(() => {
      expect(screen.getByText('Showing 21–40 of 50')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?pageSize=50');
    });
    await waitFor(() => {
      expect(NAMES(grid)).toHaveLength(50);
    });
    expect(api.callsTo('GET /users').at(-1)?.options.query).toMatchObject({
      page: 1,
      pageSize: 50,
    });
  });

  it('shows "No results" with "Clear filters" and goes back to the defaults', async () => {
    const user = setupUser();
    const { router } = await renderUsers();
    await table();

    await user.type(screen.getByRole('searchbox', { name: 'Search by name or email' }), 'zzz');

    expect(await screen.findByText('No users match these filters.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await screen.findByRole('rowheader', { name: 'Sample Admin' })).toBeInTheDocument();
  });

  it('shows the server error state with a retry when the list cannot be read', async () => {
    const user = setupUser();
    await renderUsers({
      prepare: (api) => {
        api.failNext('GET /users', new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
      },
    });

    expect(await screen.findByText('Something went wrong on our side')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('rowheader', { name: 'Sample Admin' })).toBeInTheDocument();
  });

  it('shows the page in the sidebar of an administrator, marked as the current one', async () => {
    await renderUsers();
    await table();
    const nav = screen.getByRole('navigation', { name: /main|primary|sidebar/i });
    expect(within(nav).getByRole('link', { name: 'Users & roles' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
