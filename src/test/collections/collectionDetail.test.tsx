// Collection detail (S-15a-c): the overview, the fields and the variable assignments tabs (the tab is in the URL),
// the links, loading and errors, not found, the application of the collection (D-78) and the buttons by role.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeCollection, makeField } from '../helpers/fakeCollectionsApi';
import { makeApplication } from '../helpers/renderApp';
import { renderCollections, type RenderCollectionsOptions } from '../helpers/renderCollections';
import { setupUser } from '../helpers/setupUser';

const open = (extra: Partial<RenderCollectionsOptions> = {}) =>
  renderCollections({ path: '/collections/11', ...extra });

async function ready() {
  await screen.findByRole('heading', { name: 'colClientes', level: 1 });
}

describe('collection detail: overview', () => {
  it('shows the header, the creation condition and the details', async () => {
    await open();
    await ready();

    expect(screen.getByText('Updated 2026-10-02 14:31')).toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: 'Collection sections' });
    expect(within(tabs).getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const condition = screen.getByRole('region', { name: 'Creation condition' });
    expect(
      within(condition).getByText('ClearCollect(colClientes, Filter(Clientes, Activo = true))'),
    ).toHaveClass('font-mono');

    const details = screen.getByRole('region', { name: 'Details' });
    expect(within(details).getByText('Active clients shown on the home gallery.')).toBeVisible();
    expect(within(details).getByText('Yes')).toBeInTheDocument();
    expect(within(details).getByRole('link', { name: 'colUsuarios' })).toHaveAttribute(
      'href',
      '/collections/20',
    );
    expect(within(details).getByText('Fewer rows in production.')).toBeInTheDocument();
    expect(within(details).getByText('No known differences.')).toBeInTheDocument();
  });

  it('draws the "Used by screens" card with one row per screen and the access of each use (D-103)', async () => {
    await open();
    await ready();

    const card = await screen.findByRole('region', { name: 'Used by screens' });
    expect(await within(card).findByText('2 · edited in each screen')).toBeInTheDocument();
    const table = within(card).getByRole('table', { name: 'Used by screens' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const inicio = rows[0] as HTMLElement;
    const detalle = rows[1] as HTMLElement;
    expect(within(inicio).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
      'href',
      '/screens/11',
    );
    expect(within(inicio).getByText('Read')).toBeInTheDocument();
    expect(within(inicio).getByText('galClientes.Items')).toHaveClass('font-mono');
    expect(within(detalle).getByRole('link', { name: 'Detalle' })).toHaveAttribute(
      'href',
      '/screens/12',
    );
    expect(within(detalle).getByText('Read-write')).toBeInTheDocument();
    expect(within(detalle).getByText('btnGuardar.OnSelect')).toBeInTheDocument();
  });

  it('groups the uses of one screen in one row and counts distinct screens', async () => {
    await open({
      usage: {
        11: [
          {
            screenId: 10,
            screenName: 'App (OnStart)',
            accessMode: 'READ_WRITE',
            usedIn: 'OnStart',
            isAppContext: true,
          },
          { screenId: 11, screenName: 'Inicio', accessMode: 'READ', usedIn: 'OnVisible' },
          { screenId: 11, screenName: 'Inicio', accessMode: 'WRITE', usedIn: 'btnA.OnSelect' },
        ],
      },
    });
    await ready();

    const card = await screen.findByRole('region', { name: 'Used by screens' });
    expect(await within(card).findByText('2 · edited in each screen')).toBeInTheDocument();
    const rows = within(within(card).getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    const app = rows[0] as HTMLElement;
    const inicio = rows[1] as HTMLElement;
    expect(
      within(inicio)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Read', 'Write', 'OnVisible', 'btnA.OnSelect']);
    // App (OnStart) is a screen like the others, with its Reserved tag.
    expect(within(app).getByRole('link', { name: 'App (OnStart)' })).toHaveAttribute(
      'href',
      '/screens/10',
    );
    expect(within(app).getByText('Reserved')).toBeInTheDocument();
  });

  it('says so when no screen uses the collection', async () => {
    await open({ path: '/collections/12' });

    const card = await screen.findByRole('region', { name: 'Used by screens' });
    expect(await within(card).findByText('No screen uses this collection yet.')).toBeVisible();
    expect(within(card).queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows its own error with a retry when the screens cannot be read, and the rest of the page keeps working', async () => {
    const user = setupUser();
    const { api } = await open({
      prepare: (fake) => {
        fake.failNext(
          'GET /dependencies/{type}/{id}',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        );
      },
    });
    await ready();

    const card = await screen.findByRole('region', { name: 'Used by screens' });
    expect(
      await within(card).findByText("Couldn't load the screens that use this collection."),
    ).toBeVisible();
    // The rest of the overview is there.
    expect(screen.getByRole('region', { name: 'Creation condition' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Details' })).toBeVisible();
    await user.click(within(card).getByRole('button', { name: 'Try again' }));
    expect(await within(card).findByRole('link', { name: 'Inicio' })).toBeVisible();
    expect(api.callsTo('GET /dependencies/{type}/{id}')).toHaveLength(2);
  });

  it('reads the screens of the collection with depth 1', async () => {
    const { api } = await open();
    await ready();
    await screen.findByRole('link', { name: 'Inicio' });

    const call = api.callsTo('GET /dependencies/{type}/{id}')[0];
    expect(call?.options.path).toEqual({ type: 'collections', id: 11 });
    expect(call?.options.query).toEqual({ depth: 1 });
  });

  it('says so when the collection is not linked to any screen, has no derivation and no texts', async () => {
    await open({ path: '/collections/12' });

    expect(await screen.findByRole('heading', { name: 'colTemporal', level: 1 })).toBeVisible();
    const details = screen.getByRole('region', { name: 'Details' });
    expect(within(details).getByText('Not linked')).toBeInTheDocument();
    expect(within(details).getByText('None')).toBeInTheDocument();
    expect(within(details).getByText('No description.')).toBeInTheDocument();
    expect(screen.getByText('No creation condition.')).toBeInTheDocument();
  });

  it('shows the breadcrumb "Collections / <name>" with a link back to the list', async () => {
    await open();
    await ready();

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(await within(breadcrumb).findByText('colClientes')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(breadcrumb).getByRole('link', { name: 'Collections' })).toHaveAttribute(
      'href',
      '/collections',
    );
  });
});

describe('collection detail: tabs in the URL', () => {
  it('shows the counts of the fields and of the assignments in the tabs', async () => {
    await open();
    await ready();

    expect(screen.getByRole('tab', { name: /^Fields\s*4$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Variable assignments\s*3$/ })).toBeInTheDocument();
  });

  it('switches tab through the URL and keeps the other parameters', async () => {
    const user = setupUser();
    const { router } = await open();
    await ready();

    await user.click(screen.getByRole('tab', { name: /^Fields/ }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?tab=fields');
    });
    expect(screen.getByRole('tab', { name: /^Fields/ })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('table', { name: 'Fields' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Variable assignments/ }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?tab=assignments');
    });
    expect(await screen.findByRole('table', { name: 'Variable assignments' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(screen.getByRole('region', { name: 'Creation condition' })).toBeInTheDocument();
  });

  it('opens on the tab of the URL, and the back button returns to the previous tab', async () => {
    const user = setupUser();
    const { router } = await open({ path: '/collections/11?tab=assignments' });
    await ready();

    expect(screen.getByRole('tab', { name: /^Variable assignments/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(screen.getByRole('tab', { name: /^Fields/ }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?tab=fields');
    });

    await router.navigate(-1);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /^Variable assignments/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('falls back to the overview for a tab that does not exist', async () => {
    await open({ path: '/collections/11?tab=bogus' });
    await ready();

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves between tabs with the arrow keys', async () => {
    const user = setupUser();
    const { router } = await open();
    await ready();

    screen.getByRole('tab', { name: 'Overview' }).focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?tab=fields');
    });
    expect(screen.getByRole('tab', { name: /^Fields/ })).toHaveFocus();
    await user.keyboard('{End}');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?tab=assignments');
    });
    await user.keyboard('{ArrowRight}');
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
  });
});

describe('collection detail: fields tab', () => {
  it('lists the fields from GET /collections/{id}/fields, ordered by position', async () => {
    const out = makeCollection(30, 'colDesordenada', {
      fields: [
        makeField(1, 'Tercero', 2),
        makeField(2, 'Primero', 0, { dataType: 'NUMBER', description: 'The first one.' }),
        makeField(3, 'Segundo', 1, { dataType: 'DATE_TIME' }),
      ],
    });
    const { api } = await open({ path: '/collections/30?tab=fields', collections: [out] });

    const table = await screen.findByRole('table', { name: 'Fields' });
    await waitFor(() => {
      expect(within(table).getAllByRole('row')).toHaveLength(4);
    });
    const names = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[1]?.textContent);
    expect(names).toEqual(['Primero', 'Segundo', 'Tercero']);
    const first = within(table).getAllByRole('row')[1] as HTMLElement;
    expect(within(first).getByText('Primero')).toHaveClass('font-mono');
    expect(within(first).getByText('Number')).toBeInTheDocument();
    expect(within(first).getByText('The first one.')).toBeInTheDocument();
    expect(within(table).getByText('DateTime')).toBeInTheDocument();
    expect(api.callsTo('GET /collections/{id}/fields')[0]?.options).toMatchObject({
      path: { id: 30 },
      query: { page: 1, pageSize: 20 },
    });
  });

  it('pages the fields with the page and its size in the URL', async () => {
    const user = setupUser();
    const many = makeCollection(31, 'colGrande', {
      fields: Array.from({ length: 45 }, (_, index) =>
        makeField(100 + index, `campo${String(index).padStart(2, '0')}`, index),
      ),
    });
    const { router } = await open({ path: '/collections/31?tab=fields', collections: [many] });
    await screen.findByText('Showing 1–20 of 45');

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Showing 21–40 of 45');
    expect(router.state.location.search).toBe('?tab=fields&fpage=2');
    const table = screen.getByRole('table', { name: 'Fields' });
    expect(within(table).getByText('campo20')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');
    await screen.findByText('Showing 1–45 of 45');
    expect(router.state.location.search).toBe('?tab=fields&fsize=50');
  });

  it('says so when the collection has no fields', async () => {
    await open({
      path: '/collections/32?tab=fields',
      collections: [makeCollection(32, 'colVacia')],
    });

    expect(await screen.findByText('No fields yet.')).toBeInTheDocument();
  });

  it('shows the failure of the fields alone, with a retry, and keeps the rest of the page', async () => {
    const user = setupUser();
    await open({
      path: '/collections/11?tab=fields',
      prepare: (api) => {
        api.failNext(
          'GET /collections/{id}/fields',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        );
      },
    });

    expect(await screen.findByText("Couldn't load the fields.")).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'colClientes', level: 1 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    const table = await screen.findByRole('table', { name: 'Fields' });
    expect(await within(table).findByText('Nombre')).toBeInTheDocument();
  });
});

describe('collection detail: assignments tab', () => {
  it('shows variable, function, table function, screen and used in, with links', async () => {
    await open({ path: '/collections/11?tab=assignments' });

    const table = await screen.findByRole('table', { name: 'Variable assignments' });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    const first = within(table)
      .getByRole('link', { name: 'gRegistroSel' })
      .closest('tr') as HTMLElement;
    expect(within(first).getByRole('link', { name: 'gRegistroSel' })).toHaveAttribute(
      'href',
      '/variables/3',
    );
    expect(within(first).getByText('Set')).toBeInTheDocument();
    expect(within(first).getByText('First')).toHaveClass('font-mono');
    expect(within(first).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
      'href',
      '/screens/11',
    );
    expect(within(first).getByText('galClientes.OnSelect')).toHaveClass('font-mono');

    const context = within(table)
      .getByRole('link', { name: 'locMostrarDetalle' })
      .closest('tr') as HTMLElement;
    expect(within(context).getByText('UpdateContext')).toBeInTheDocument();
  });

  it('links App (OnStart) to its screen like any other screen and shows "—" for no table function', async () => {
    await open({ path: '/collections/11?tab=assignments' });

    const table = await screen.findByRole('table', { name: 'Variable assignments' });
    const row = within(table)
      .getByRole('link', { name: 'gFiltroActivo' })
      .closest('tr') as HTMLElement;
    expect(within(row).getByRole('link', { name: 'App (OnStart)' })).toHaveAttribute(
      'href',
      '/screens/10',
    );
    expect(within(row).getByText('—')).toBeInTheDocument();
  });

  it('says so when there are no assignments', async () => {
    await open({
      path: '/collections/12?tab=assignments',
    });

    expect(await screen.findByText('No variable assignments yet.')).toBeInTheDocument();
  });

  it('leads from a variable to its collection (the link of the variable detail)', async () => {
    const user = setupUser();
    const { router } = await open({ path: '/collections/11?tab=assignments' });
    const table = await screen.findByRole('table', { name: 'Variable assignments' });

    await user.click(within(table).getByRole('link', { name: 'gRegistroSel' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/variables/3');
    });
  });
});

describe('collection detail: states and roles', () => {
  it('shows "This collection doesn\'t exist" for an unknown id', async () => {
    const user = setupUser();
    const { router } = await open({ path: '/collections/999' });

    expect(await screen.findByText("This collection doesn't exist")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to Collections' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/collections');
    });
  });

  it('shows "doesn\'t exist" for an id that is not a number without asking the server', async () => {
    const { api } = await open({ path: '/collections/abc' });

    expect(await screen.findByText("This collection doesn't exist")).toBeInTheDocument();
    expect(api.callsTo('GET /collections/{id}')).toHaveLength(0);
  });

  it('shows the server error state with a retry', async () => {
    const user = setupUser();
    await open({
      prepare: (api) => {
        api.failNext(
          'GET /collections/{id}',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        );
      },
    });

    expect(await screen.findByText('Something went wrong on our side')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await ready();
  });

  it('gives the Reader the detail without Edit or Delete', async () => {
    await open({ role: 'READER' });
    await ready();

    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument();
  });

  it('offers Edit to the Developer, leading to the edit page', async () => {
    const user = setupUser();
    const { router } = await open();
    await ready();

    await user.click(screen.getByRole('link', { name: 'Edit' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/collections/11/edit');
    });
  });

  it('disables Edit and Delete with the reason when the application is archived', async () => {
    await open({ applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })] });
    await ready();

    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(edit).toBeDisabled();
    expect(edit).toHaveAttribute('title', 'Read-only: the application is archived.');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute(
      'title',
      'Read-only: the application is archived.',
    );
  });

  it('selects the application of the collection when it is not the selected one (D-78)', async () => {
    const other = makeCollection(40, 'colOtra', { applicationId: 2 });
    const { router } = await open({
      path: '/collections/40',
      collections: [other],
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
    });

    expect(await screen.findByText('Switched to Billing.')).toBeInTheDocument();
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByText('Billing')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/collections/40');
  });

  it('does not announce a switch when the collection belongs to the selected application', async () => {
    await open();
    await ready();

    expect(screen.queryByText(/Switched to/)).not.toBeInTheDocument();
  });

  it('goes back to the list when the application is switched from the shell', async () => {
    const user = setupUser();
    const { router } = await open({
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
    });
    await ready();

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/collections');
    });
  });

  it('deletes from the detail with the impact and goes back to the list', async () => {
    const user = setupUser();
    const { router, api } = await open();
    await ready();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete colClientes?' }));
    expect(
      await dialog.findByText(
        /Its 4 fields, 3 variable assignments, 1 derivation and its links to 2 screens are deleted too\./,
      ),
    ).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Delete collection' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/collections');
    });
    expect(api.callsTo('DELETE /collections/{id}')).toHaveLength(1);
    expect(await screen.findByText('colClientes deleted.')).toBeInTheDocument();
  });
});
