// Collection list (S-14): rows, the counts of the subtitle, filters / sort / page reflected in the URL (q, environment,
// undocumented), the undocumented filter and its toggle, loading, empty and error states, the reset on changing
// application, the Reader view and the archived application.
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeApplication } from '../helpers/renderApp';
import { makeCollection } from '../helpers/fakeCollectionsApi';
import { renderCollections } from '../helpers/renderCollections';

const ROW_NAMES = (table: HTMLElement) =>
  within(table)
    .getAllByRole('link')
    .map((link) => link.textContent);

/** The table once the application is known and its first load has finished. */
async function table() {
  await screen.findAllByText(/collections? ·|Read-only: the application is archived/);
  const grid = await screen.findByRole('table', { name: 'Collections' });
  await waitFor(() => {
    expect(grid).toHaveAttribute('aria-busy', 'false');
  });
  return grid;
}

describe('collection list', () => {
  it('shows the collections with environments, field count, linked to screens and update time', async () => {
    await renderCollections();
    const grid = await table();

    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual(['colActivos', 'colClientes', 'colTemporal', 'colUsuarios']);
    });
    const row = within(grid)
      .getByRole('link', { name: 'colClientes' })
      .closest('tr') as HTMLElement;
    expect(within(row).getByText('DEV')).toBeInTheDocument();
    expect(within(row).getByText('PROD')).toBeInTheDocument();
    expect(within(row).getByText('4')).toBeInTheDocument();
    expect(within(row).getByText('Yes')).toBeInTheDocument();
    expect(within(row).getByText('2026-10-02 14:31')).toBeInTheDocument();
    const temporal = within(grid)
      .getByRole('link', { name: 'colTemporal' })
      .closest('tr') as HTMLElement;
    expect(within(temporal).getByText('Not linked')).toBeInTheDocument();
    expect(within(temporal).queryByText('PROD')).not.toBeInTheDocument();
    expect(within(grid).getByRole('link', { name: 'colClientes' })).toHaveAttribute(
      'href',
      '/collections/11',
    );
  });

  it('says how many collections there are and how many are not linked to any screen, loaded once', async () => {
    const { api } = await renderCollections();
    await table();

    expect(await screen.findByText(/4 collections/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 not linked to any screen' })).toBeInTheDocument();
    expect(
      api.callsTo('GET /collections').filter((c) => c.options.query?.pageSize === 1),
    ).toHaveLength(2);
  });

  it('keeps the counts when the application is archived and adds the reason after them', async () => {
    await renderCollections({
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });
    await table();

    // The frame's subtitle is the counts; the archived reason follows it, it does not replace it (S-14, S-09b).
    const subtitle = (await screen.findByText(/4 collections/)).parentElement;
    expect(subtitle).toHaveTextContent(
      '4 collections · 1 not linked to any screen · Read-only: the application is archived.',
    );
  });

  it('shows the subtitle once the counts arrive, never a blank line that stays', async () => {
    let release: () => void = () => undefined;
    const { api } = await renderCollections({
      prepare: (fake) => {
        release = fake.hold((call) => call.options.query?.pageSize === 1).release;
      },
    });
    await screen.findByRole('heading', { name: 'Collections' });
    expect(screen.queryByText(/not linked to any screen/)).not.toBeInTheDocument();

    release();

    expect(await screen.findByText(/4 collections/)).toBeInTheDocument();
    expect(
      api.callsTo('GET /collections').filter((c) => c.options.query?.pageSize === 1),
    ).toHaveLength(2);
  });

  it('says so, with a retry, when the counts cannot be read', async () => {
    const user = userEvent.setup();
    let failing = true;
    await renderCollections({
      prepare: (fake) => {
        const read = fake.client.get.bind(fake.client);
        fake.client.get = (path: string, options?: unknown) => {
          const query = (options as { query?: { pageSize?: number } } | undefined)?.query;
          if (failing && path === '/collections' && query?.pageSize === 1)
            return Promise.reject(new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
          return read(path as never, options as never);
        };
      },
    });

    expect(await screen.findByText("Couldn't load the counts.")).toBeInTheDocument();
    // The list itself keeps working.
    expect(await screen.findByRole('link', { name: 'colActivos' })).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(/4 collections/)).toBeInTheDocument();
  });

  it('does not hide the collections without screens: all of them can be "Not linked"', async () => {
    await renderCollections({
      collections: [makeCollection(1, 'colUno'), makeCollection(2, 'colDos')],
    });
    const grid = await table();

    expect(await screen.findByText(/2 collections/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2 not linked to any screen' })).toBeInTheDocument();
    expect(within(grid).getAllByText('Not linked')).toHaveLength(2);
  });

  it('filters by name with a wait after typing, through the URL and the request', async () => {
    const user = userEvent.setup();
    const { router, api } = await renderCollections();
    const grid = await table();

    await user.click(screen.getByRole('searchbox', { name: 'Search by name' }));
    await user.paste('Cli');

    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual(['colClientes']);
    });
    expect(router.state.location.search).toBe('?q=Cli');
    expect(api.callsTo('GET /collections').at(-1)?.options.query).toMatchObject({
      applicationId: 1,
      q: 'Cli',
      page: 1,
      pageSize: 20,
      sort: 'name',
    });
  });

  it('filters by environment', async () => {
    const user = userEvent.setup();
    const { router } = await renderCollections();
    const grid = await table();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Environment' }), 'PROD');

    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual(['colActivos', 'colClientes', 'colUsuarios']);
    });
    expect(router.state.location.search).toBe('?environment=PROD');
  });

  it('filters the undocumented collections with the button or the count, and toggles them back', async () => {
    const user = userEvent.setup();
    const { router, api } = await renderCollections();
    const grid = await table();

    const button = screen.getByRole('button', { name: 'Not linked to any screen' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);

    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual(['colTemporal']);
    });
    expect(router.state.location.search).toBe('?undocumented=true');
    expect(api.callsTo('GET /collections').at(-1)?.options.query).toMatchObject({
      undocumented: true,
    });
    expect(button).toHaveAttribute('aria-pressed', 'true');

    // The count in the subtitle is the same filter.
    await user.click(screen.getByRole('button', { name: '1 not linked to any screen' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    await waitFor(() => {
      expect(ROW_NAMES(grid)).toHaveLength(4);
    });
  });

  it('reads the filters from the URL, orders by the contract whitelist and sends nothing else', async () => {
    const user = userEvent.setup();
    const { router, api } = await renderCollections({
      path: '/collections?environment=DEV&sort=bogus&pageSize=7',
    });
    const grid = await table();

    // Not valid: dropped (default sort and page size); valid: kept.
    expect(api.callsTo('GET /collections')[0]?.options.query).toMatchObject({
      environment: 'DEV',
      sort: 'name',
      pageSize: 20,
    });

    await user.click(within(grid).getByRole('button', { name: 'Sort by Updated' }));
    await waitFor(() => {
      expect(router.state.location.search).toContain('sort=updatedAt');
    });
    await user.click(within(grid).getByRole('button', { name: 'Sort by Updated' }));
    await waitFor(() => {
      expect(router.state.location.search).toContain('sort=-updatedAt');
    });
    expect(api.callsTo('GET /collections').at(-1)?.options.query).toMatchObject({
      sort: '-updatedAt',
    });
  });

  it('pages with 20, 50 or 100 rows and goes back to page 1 when the size changes', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 45 }, (_, index) =>
      makeCollection(100 + index, `col${String(index).padStart(2, '0')}`),
    );
    const { router } = await renderCollections({ collections: many });
    const grid = await table();
    await waitFor(() => {
      expect(ROW_NAMES(grid)).toHaveLength(20);
    });

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Showing 21–40 of 45');
    expect(router.state.location.search).toBe('?page=2');
    expect(ROW_NAMES(grid)[0]).toBe('col20');

    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');
    await screen.findByText('Showing 1–45 of 45');
    expect(router.state.location.search).toBe('?pageSize=50');
  });

  it('shows "No results" with Clear filters when the filters match nothing', async () => {
    const user = userEvent.setup();
    const { router } = await renderCollections({ path: '/collections?q=zzz' });

    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(screen.getByText('No collections match these filters.')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0] as HTMLElement);

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await screen.findByRole('link', { name: 'colActivos' })).toBeInTheDocument();
  });

  it('shows the empty state of an application without collections', async () => {
    await renderCollections({ collections: [] });

    expect(await screen.findByText('No collections yet')).toBeInTheDocument();
    expect(
      screen.getByText("Record SAR's collections, their fields and the variables they feed."),
    ).toBeInTheDocument();
  });

  it('shows the server error state with a retry', async () => {
    const user = userEvent.setup();
    await renderCollections({
      prepare: (api) => {
        api.failNext('GET /collections', new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
      },
    });

    expect(await screen.findByText('Something went wrong on our side')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('link', { name: 'colActivos' })).toBeInTheDocument();
  });

  it('starts over when the application changes', async () => {
    const user = userEvent.setup();
    const { router } = await renderCollections({
      path: '/collections?q=Cli&environment=PROD&page=1',
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Other' })],
    });
    await table();
    expect(router.state.location.search).toContain('q=Cli');

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Other' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await screen.findByText('No collections yet')).toBeInTheDocument();
  });

  it('gives the Reader the list without create button or row actions', async () => {
    await renderCollections({ role: 'READER' });
    await table();

    expect(await screen.findByRole('link', { name: 'colActivos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New collection' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument();
  });

  it('does not open the creation modal for the Reader even with ?new=1', async () => {
    await renderCollections({ role: 'READER', path: '/collections?new=1' });
    await table();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('disables creating, editing and deleting with the reason when the application is archived', async () => {
    const user = userEvent.setup();
    await renderCollections({
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });
    await table();

    expect(screen.getByText(/Read-only: the application is archived\./)).toBeInTheDocument();
    const create = screen.getByRole('button', { name: 'New collection' });
    expect(create).toBeDisabled();
    expect(create).toHaveAttribute('title', 'Read-only: the application is archived.');
    await user.click(await screen.findByRole('button', { name: 'Actions for colClientes' }));
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('opens a collection from its row menu', async () => {
    const user = userEvent.setup();
    const { router } = await renderCollections();
    await table();

    await user.click(await screen.findByRole('button', { name: 'Actions for colClientes' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/collections/11/edit');
    });
    await act(async () => {
      await Promise.resolve();
    });
  });
});
