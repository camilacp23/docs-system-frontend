// Screen list (S-18): rows (App (OnStart) first with Reserved, the five status tags), the counts of the subtitle,
// filters / sort / page reflected in the URL (q, status, mine, sort, page, pageSize), loading, empty and error
// states, the reset on changing application, the Reader view and the archived application.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeScreenDetail } from '../helpers/fakeScreensApi';
import { makeApplication } from '../helpers/renderApp';
import { renderScreens } from '../helpers/renderScreens';
import { setupUser } from '../helpers/setupUser';

const ROW_NAMES = (table: HTMLElement) =>
  within(table)
    .getAllByRole('link')
    .map((link) => link.textContent);

/** The table once the application is known and its first load has finished. */
async function table() {
  await screen.findAllByText(/screens? ·|Read-only: the application is archived/);
  const grid = await screen.findByRole('table', { name: 'Screens' });
  await waitFor(() => {
    expect(grid).toHaveAttribute('aria-busy', 'false');
  });
  return grid;
}

const rowOf = (grid: HTMLElement, name: string) =>
  within(grid).getByRole('link', { name }).closest('tr') as HTMLElement;

describe('screen list', () => {
  it('shows App (OnStart) first with Reserved, and the status, author, to-dos, comments and update time', async () => {
    await renderScreens();
    const grid = await table();

    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual([
        'App (OnStart)',
        'Busqueda',
        'Detalle',
        'Inicio',
        'Reportes',
      ]);
    });
    const app = rowOf(grid, 'App (OnStart)');
    expect(within(app).getByText('Reserved')).toBeInTheDocument();
    expect(within(app).getByText('In progress')).toBeInTheDocument();
    expect(within(app).getByText('Camila Castillo')).toBeInTheDocument();
    expect(within(app).getByText('2')).toBeInTheDocument();
    expect(within(app).getByText('2026-10-03 09:14')).toBeInTheDocument();
    expect(within(grid).getAllByText('Reserved')).toHaveLength(1);

    const detalle = rowOf(grid, 'Detalle');
    expect(within(detalle).getByText('In review')).toBeInTheDocument();
    expect(within(detalle).getByText('Sample Developer A')).toBeInTheDocument();
    expect(within(detalle).getByText('3')).toBeInTheDocument();
    expect(within(grid).getByRole('link', { name: 'Detalle' })).toHaveAttribute(
      'href',
      '/screens/12',
    );
    // No pending to-dos: a dash, not a zero.
    expect(within(rowOf(grid, 'Inicio')).getAllByText('—')).toHaveLength(1);
  });

  it('draws the five statuses with their label', async () => {
    await renderScreens();
    const grid = await table();

    for (const label of ['Undocumented', 'Draft', 'In progress', 'In review', 'Approved']) {
      expect(within(grid).getByText(label)).toBeInTheDocument();
    }
  });

  it('keeps App (OnStart) first whatever the order', async () => {
    const user = setupUser();
    await renderScreens();
    const grid = await table();

    await user.click(within(grid).getByRole('button', { name: 'Sort by Name' }));
    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual([
        'App (OnStart)',
        'Reportes',
        'Inicio',
        'Detalle',
        'Busqueda',
      ]);
    });
  });

  it('says how many screens there are and how many are approved, loaded once', async () => {
    const { api } = await renderScreens();
    await table();

    expect(await screen.findByText(/5 screens · 1 approved/)).toBeInTheDocument();
    // The two counts of the subtitle (the application card reads its own total, D-98, and the Review item of the menu
    // reads the screens In review).
    const light = api.callsTo('GET /screens').filter((c) => c.options.query?.pageSize === 1);
    expect(light.filter((c) => c.options.query?.documentationStatus === 'APPROVED')).toHaveLength(
      1,
    );
    expect(light.filter((c) => c.options.query?.documentationStatus === 'IN_REVIEW')).toHaveLength(
      1,
    );
    expect(light).toHaveLength(4);
  });

  it('keeps the counts when the application is archived and adds the reason after them', async () => {
    await renderScreens({
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });
    await table();

    const subtitle = (await screen.findByText(/5 screens/)).parentElement;
    expect(subtitle).toHaveTextContent(
      '5 screens · 1 approved · Read-only: the application is archived.',
    );
  });

  it('shows the subtitle once the counts arrive, never a blank line that stays', async () => {
    let release: () => void = () => undefined;
    await renderScreens({
      prepare: (fake) => {
        release = fake.hold((call) => call.options.query?.pageSize === 1).release;
      },
    });
    await screen.findByRole('heading', { name: 'Screens' });
    expect(screen.queryByText(/approved/)).not.toBeInTheDocument();

    release();

    expect(await screen.findByText(/5 screens · 1 approved/)).toBeInTheDocument();
  });

  it('says so, with a retry, when the counts cannot be read', async () => {
    const user = setupUser();
    let failing = true;
    await renderScreens({
      prepare: (fake) => {
        const read = fake.client.get.bind(fake.client);
        fake.client.get = (path: string, options?: unknown) => {
          const query = (options as { query?: { pageSize?: number } } | undefined)?.query;
          if (failing && path === '/screens' && query?.pageSize === 1)
            return Promise.reject(new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
          return read(path as never, options as never);
        };
      },
    });

    expect(await screen.findByText("Couldn't load the counts.")).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Detalle' })).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(/5 screens · 1 approved/)).toBeInTheDocument();
  });

  it('filters by name with a wait after typing, through the URL and the request', async () => {
    const user = setupUser();
    const { router, api } = await renderScreens();
    const grid = await table();

    await user.click(screen.getByRole('searchbox', { name: 'Search by name' }));
    await user.paste('det');

    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual(['Detalle']);
    });
    expect(router.state.location.search).toBe('?q=det');
    expect(api.callsTo('GET /screens').at(-1)?.options.query).toMatchObject({
      applicationId: 1,
      q: 'det',
      page: 1,
      pageSize: 20,
      sort: 'name',
    });
  });

  it('filters by status', async () => {
    const user = setupUser();
    const { router, api } = await renderScreens();
    const grid = await table();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'In review');

    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual(['Detalle']);
    });
    expect(router.state.location.search).toBe('?status=IN_REVIEW');
    expect(api.callsTo('GET /screens').at(-1)?.options.query).toMatchObject({
      documentationStatus: 'IN_REVIEW',
    });
  });

  it('filters the screens authored by me with the id of the signed-in user', async () => {
    const user = setupUser();
    const { router, api } = await renderScreens({
      screens: [
        makeScreenDetail(10, 'App (OnStart)', {
          isAppContext: true,
          author: { id: 1, name: 'Admin' },
        }),
        makeScreenDetail(21, 'Mine', { author: { id: 7, name: 'Ana Mora' } }),
        makeScreenDetail(22, 'Theirs', { author: { id: 2, name: 'Someone' } }),
      ],
    });
    const grid = await table();

    const button = screen.getByRole('button', { name: 'Authored by me' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);

    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual(['Mine']);
    });
    expect(router.state.location.search).toBe('?mine=true');
    expect(api.callsTo('GET /screens').at(-1)?.options.query).toMatchObject({ authorId: 7 });
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await user.click(button);
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
  });

  it('reads the state from the URL and orders by the contract whitelist', async () => {
    const user = setupUser();
    const { router, api } = await renderScreens({
      path: '/screens?status=DRAFT&sort=bogus&pageSize=7',
    });
    const grid = await table();

    // Not valid: dropped (default sort and page size); valid: kept.
    expect(
      api.callsTo('GET /screens').find((c) => c.options.query?.pageSize !== 1)?.options.query,
    ).toMatchObject({
      documentationStatus: 'DRAFT',
      sort: 'name',
      pageSize: 20,
    });

    await user.click(within(grid).getByRole('button', { name: 'Sort by Pending to-dos' }));
    await waitFor(() => {
      expect(router.state.location.search).toContain('sort=pendingSubtasks');
    });
    await user.click(within(grid).getByRole('button', { name: 'Sort by Pending to-dos' }));
    await waitFor(() => {
      expect(router.state.location.search).toContain('sort=-pendingSubtasks');
    });
    expect(api.callsTo('GET /screens').at(-1)?.options.query).toMatchObject({
      sort: '-pendingSubtasks',
    });
  });

  it('sorts by status and by update time', async () => {
    const user = setupUser();
    const { router } = await renderScreens();
    const grid = await table();

    await user.click(within(grid).getByRole('button', { name: 'Sort by Status' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?sort=documentationStatus');
    });
    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual([
        'App (OnStart)',
        'Reportes',
        'Busqueda',
        'Detalle',
        'Inicio',
      ]);
    });
    await user.click(within(grid).getByRole('button', { name: 'Sort by Updated' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?sort=updatedAt');
    });
  });

  it('pages with 20, 50 or 100 rows and goes back to page 1 when the size changes', async () => {
    const user = setupUser();
    const many = [
      makeScreenDetail(10, 'App (OnStart)', { isAppContext: true }),
      ...Array.from({ length: 44 }, (_, index) =>
        makeScreenDetail(100 + index, `scr${String(index).padStart(2, '0')}`),
      ),
    ];
    const { router } = await renderScreens({ screens: many });
    const grid = await table();
    await waitFor(() => {
      expect(ROW_NAMES(grid)).toHaveLength(20);
    });

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Showing 21–40 of 45');
    expect(router.state.location.search).toBe('?page=2');

    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');
    await screen.findByText('Showing 1–45 of 45');
    expect(router.state.location.search).toBe('?pageSize=50');
  });

  it('shows "No results" with Clear filters when the filters match nothing', async () => {
    const user = setupUser();
    const { router } = await renderScreens({ path: '/screens?q=zzz' });

    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(screen.getByText('No screens match these filters.')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0] as HTMLElement);

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await screen.findByRole('link', { name: 'Detalle' })).toBeInTheDocument();
  });

  it('shows the empty state of an application without screens', async () => {
    await renderScreens({ screens: [] });

    expect(await screen.findByText('No screens yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        "Document SAR's screens, their template and the variables and collections they use.",
      ),
    ).toBeInTheDocument();
  });

  it('shows the server error state with a retry', async () => {
    const user = setupUser();
    await renderScreens({
      prepare: (fake) => {
        // Only the read of the list fails once (the counts and the application card read /screens too).
        const read = fake.client.get.bind(fake.client);
        let failed = false;
        fake.client.get = (path: string, options?: unknown) => {
          const query = (options as { query?: { pageSize?: number } } | undefined)?.query;
          if (!failed && path === '/screens' && query?.pageSize === 20) {
            failed = true;
            return Promise.reject(new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
          }
          return read(path as never, options as never);
        };
      },
    });

    expect(await screen.findByText('Something went wrong on our side')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('link', { name: 'Detalle' })).toBeInTheDocument();
  });

  it('starts over when the application changes', async () => {
    const user = setupUser();
    const { router } = await renderScreens({
      path: '/screens?q=det&status=IN_REVIEW',
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Other' })],
    });
    await table();
    expect(router.state.location.search).toContain('q=det');

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Other' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await screen.findByText('No screens yet')).toBeInTheDocument();
  });

  it('gives the Reader the list without row actions', async () => {
    await renderScreens({ role: 'READER' });
    await table();

    expect(await screen.findByRole('link', { name: 'Detalle' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New screen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
  });
});
