// Application list (S-07): rows with platform, Jira project, status, App (OnStart) screen, creator and update time,
// the counts, status / search / page reflected in the URL and the request, loading, empty and error states.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeApplication } from '../helpers/renderApp';
import { renderApplications, sampleApplications } from '../helpers/renderApplications';
import { setupUser } from '../helpers/setupUser';

const NAMES = (table: HTMLElement) =>
  within(table)
    .getAllByRole('rowheader')
    .map((cell) => cell.textContent.trim());

/** The table once its first load has finished. */
async function table() {
  const grid = await screen.findByRole('table', { name: 'Applications' });
  await waitFor(() => {
    expect(grid).toHaveAttribute('aria-busy', 'false');
  });
  return grid;
}

describe('application list', () => {
  it('shows the applications ordered by name, with the columns of the frame', async () => {
    const { api } = await renderApplications();
    const grid = await table();

    // The shell reads every application (100 per page); the page reads its own list (20 per page).
    const own = api.callsTo('GET /applications').filter((c) => c.options.query?.pageSize === 20);
    expect(own.at(-1)?.options.query).toEqual({ page: 1, pageSize: 20 });
    expect(NAMES(grid)).toEqual(['Application B', 'Application C', 'SAR']);
    const b = within(grid)
      .getByRole('rowheader', { name: 'Application B' })
      .closest('tr') as HTMLElement;
    expect(within(b).getByText('Power Apps')).toBeInTheDocument();
    expect(within(b).getByText('APPB')).toBeInTheDocument();
    expect(within(b).getByText('Active')).toBeInTheDocument();
    expect(within(b).getByText('App (OnStart)')).toBeInTheDocument();
    expect(within(b).getByText('Ana Mora')).toBeInTheDocument();
    expect(within(b).getByText('2026-10-02 09:40')).toBeInTheDocument();
    const c = within(grid)
      .getByRole('rowheader', { name: 'Application C' })
      .closest('tr') as HTMLElement;
    expect(within(c).getByText('Archived')).toBeInTheDocument();
    expect(within(c).getByText('TECHEA (default)')).toBeInTheDocument();
    expect(within(c).getByText('Sample Admin')).toBeInTheDocument();
  });

  it('says how many applications there are and how many are archived', async () => {
    await renderApplications();
    await table();
    expect(await screen.findByText('3 applications · 1 archived')).toBeInTheDocument();
  });

  it('leaves out "archived" when none is', async () => {
    await renderApplications({ applications: [makeApplication(1, { name: 'SAR' })] });
    await table();
    expect(await screen.findByText('1 application')).toBeInTheDocument();
  });

  it('filters by status through the URL and the request', async () => {
    const user = setupUser();
    const { router, api } = await renderApplications();
    const grid = await table();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'ARCHIVED');

    await waitFor(() => {
      expect(NAMES(grid)).toEqual(['Application C']);
    });
    expect(router.state.location.search).toBe('?status=ARCHIVED');
    expect(api.callsTo('GET /applications').at(-1)?.options.query).toMatchObject({
      status: 'ARCHIVED',
    });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), '');
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    await waitFor(() => {
      expect(NAMES(grid)).toHaveLength(3);
    });
  });

  it('waits for the user to stop typing before searching by name', async () => {
    const user = setupUser();
    const { router, api } = await renderApplications();
    const grid = await table();
    const before = api.callsTo('GET /applications').length;

    await user.type(screen.getByRole('searchbox', { name: 'Search applications' }), 'application');

    await waitFor(() => {
      expect(router.state.location.search).toBe('?q=application');
    });
    await waitFor(() => {
      expect(NAMES(grid)).toEqual(['Application B', 'Application C']);
    });
    expect(api.callsTo('GET /applications').length).toBe(before + 1);
  });

  it('pages by 20, 50 or 100', async () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      makeApplication(100 + index, { name: `Zeta ${String(index).padStart(2, '0')}` }),
    );
    const user = setupUser();
    const { router } = await renderApplications({
      applications: [...sampleApplications(), ...many],
    });
    const grid = await table();
    await waitFor(() => {
      expect(NAMES(grid)).toHaveLength(20);
    });
    expect(screen.getByText('Showing 1–20 of 28')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?page=2');
    });
    await waitFor(() => {
      expect(screen.getByText('Showing 21–28 of 28')).toBeInTheDocument();
    });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');
    await waitFor(() => {
      expect(NAMES(grid)).toHaveLength(28);
    });
    expect(router.state.location.search).toBe('?pageSize=50');
  });

  it('shows "No results" with "Clear filters" when nothing matches', async () => {
    const user = setupUser();
    const { router } = await renderApplications();
    await table();

    await user.type(screen.getByRole('searchbox', { name: 'Search applications' }), 'zzz');

    expect(await screen.findByText('No applications match these filters.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await screen.findByRole('rowheader', { name: 'SAR' })).toBeInTheDocument();
  });

  it('invites the administrator to register the first application when there is none', async () => {
    const user = setupUser();
    await renderApplications({ applications: [] });

    expect(await screen.findByText('No applications yet')).toBeInTheDocument();
    expect(
      screen.getByText('Register the first application to start documenting it.'),
    ).toBeInTheDocument();
    const buttons = screen.getAllByRole('button', { name: 'Register application' });
    expect(buttons.length).toBeGreaterThan(0);
    await user.click(buttons[buttons.length - 1] as HTMLElement);
    expect(await screen.findByRole('dialog', { name: 'Register application' })).toBeInTheDocument();
  });

  it('shows the server error state with a retry when the list cannot be read', async () => {
    const user = setupUser();
    await renderApplications({
      prepare: (api) => {
        // The shell reads the applications first; the page reads its own list second.
        api.failNext('GET /applications', new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
      },
    });

    // Either the shell or the page fails first; both offer the same retry.
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('rowheader', { name: 'SAR' })).toBeInTheDocument();
  });

  it('the name of a row opens the edit form', async () => {
    const user = setupUser();
    await renderApplications();
    await table();

    await user.click(await screen.findByRole('button', { name: 'SAR' }));

    expect(await screen.findByRole('dialog', { name: 'Edit application' })).toBeInTheDocument();
  });

  it('marks the page in the sidebar of the administrator', async () => {
    await renderApplications();
    await table();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Applications' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
