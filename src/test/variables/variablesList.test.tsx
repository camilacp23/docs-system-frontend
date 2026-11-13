// Variable list (S-10, S-10r): rows, counters, filters / sort / page reflected in the URL, loading, empty and error
// states, the reset on changing application, and the Reader view.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makeApplication } from '../helpers/renderApp';
import { makeVariable } from '../helpers/fakeVariablesApi';
import { renderVariables, sampleVariables } from '../helpers/renderVariables';
import { setupUser } from '../helpers/setupUser';

const ROW_NAMES = (table: HTMLElement) =>
  within(table)
    .getAllByRole('link')
    .map((link) => link.textContent);

/** The table once the application is known and its first load has finished. */
async function table() {
  await screen.findByText(/Global and context variables of|Read-only: the application is archived/);
  const grid = await screen.findByRole('table', { name: 'Variables' });
  await waitFor(() => {
    expect(grid).toHaveAttribute('aria-busy', 'false');
  });
  return grid;
}

describe('variable list', () => {
  it('shows the variables with type, scope, environments, origin screen and update time', async () => {
    await renderVariables();
    const grid = await table();

    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual([
        'gFiltroActivo',
        'gRegistroSel',
        'gUsuario',
        'locMostrarDetalle',
        'locOrden',
      ]);
    });
    const row = within(grid).getByRole('link', { name: 'gUsuario' }).closest('tr') as HTMLElement;
    expect(within(row).getByText('Record')).toBeInTheDocument();
    expect(within(row).getByText('Set · Global')).toBeInTheDocument();
    expect(within(row).getByText('DEV')).toBeInTheDocument();
    expect(within(row).getByText('PROD')).toBeInTheDocument();
    expect(within(row).getByText('App (OnStart)')).toBeInTheDocument();
    expect(within(row).getByText('2026-10-03 09:14')).toBeInTheDocument();
    const context = within(grid)
      .getByRole('link', { name: 'locOrden' })
      .closest('tr') as HTMLElement;
    expect(within(context).getByText('UpdateContext · Context')).toBeInTheDocument();
    const untraced = within(grid)
      .getByRole('link', { name: 'gRegistroSel' })
      .closest('tr') as HTMLElement;
    expect(within(untraced).getByText('Untraced')).toBeInTheDocument();
    expect(within(grid).getByRole('link', { name: 'gUsuario' })).toHaveAttribute(
      'href',
      '/variables/1',
    );
  });

  it('shows the four counters, loaded once, and the application in the subtitle', async () => {
    const { api } = await renderVariables();
    await table();
    const counts = await screen.findByRole('region', { name: 'Variable counts' });

    await waitFor(() => {
      expect(within(counts).getByText('Global · Set').previousElementSibling).toHaveTextContent(
        '3',
      );
    });
    expect(within(counts).getByText('Variables').previousElementSibling).toHaveTextContent('5');
    expect(
      within(counts).getByText('Context · UpdateContext').previousElementSibling,
    ).toHaveTextContent('2');
    expect(
      within(counts).getByText(/Without origin screen/).previousElementSibling,
    ).toHaveTextContent('1');
    expect(screen.getByText(/Global and context variables of SAR/)).toBeInTheDocument();
    expect(
      api.callsTo('GET /variables').filter((c) => c.options.query?.pageSize === 1),
    ).toHaveLength(4);
  });

  it('does not reload the counters when a filter changes', async () => {
    const user = setupUser();
    const { api } = await renderVariables();
    await table();
    await waitFor(() => {
      expect(api.callsTo('GET /variables')).toHaveLength(5);
    });

    await user.click(screen.getByRole('radio', { name: 'Global' }));

    await waitFor(() => {
      expect(api.callsTo('GET /variables')).toHaveLength(6);
    });
  });

  it('filters by scope through the URL and the request', async () => {
    const user = setupUser();
    const { router, api } = await renderVariables();
    const grid = await table();

    await user.click(screen.getByRole('radio', { name: 'Context' }));

    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual(['locMostrarDetalle', 'locOrden']);
    });
    expect(router.state.location.search).toBe('?scope=CONTEXT');
    expect(api.callsTo('GET /variables').at(-1)?.options.query).toMatchObject({
      applicationId: 1,
      scope: 'CONTEXT',
      page: 1,
      pageSize: 20,
      sort: 'name',
    });

    await user.click(screen.getByRole('radio', { name: 'All' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
  });

  it('filters by data type, environment, origin screen (from GET /screens) and untraced', async () => {
    const user = setupUser();
    const { router, api } = await renderVariables();
    const grid = await table();
    await waitFor(() => {
      expect(
        within(screen.getByRole('combobox', { name: 'Origin screen' })).getAllByRole('option'),
      ).toHaveLength(4);
    });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Data type' }), 'BOOLEAN');
    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual(['gFiltroActivo', 'locMostrarDetalle']);
    });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Origin screen' }), 'Inicio');
    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual(['gFiltroActivo']);
    });
    expect(api.callsTo('GET /variables').at(-1)?.options.query).toMatchObject({
      dataType: 'BOOLEAN',
      originScreenId: 11,
    });

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Environment' }), 'PROD');
    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual(['gRegistroSel', 'gUsuario']);
    });
  });

  it('the untraced counter is a filter that can be toggled', async () => {
    const user = setupUser();
    const { router } = await renderVariables();
    const grid = await table();

    const card = await screen.findByRole('button', { name: /Without origin screen/ });
    expect(card).toHaveAttribute('aria-pressed', 'false');
    await user.click(card);

    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual(['gRegistroSel']);
    });
    expect(router.state.location.search).toBe('?untraced=true');
    expect(card).toHaveAttribute('aria-pressed', 'true');
    await user.click(card);
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
  });

  it('waits for the user to stop typing before searching', async () => {
    const user = setupUser();
    const { router, api } = await renderVariables();
    const grid = await table();
    await waitFor(() => {
      expect(ROW_NAMES(grid)).toHaveLength(5);
    });
    const before = api.callsTo('GET /variables').length;

    await user.type(screen.getByRole('searchbox', { name: 'Search by name' }), 'loc');

    // Three keystrokes in a row: one request, after the pause.
    await waitFor(() => {
      expect(router.state.location.search).toBe('?q=loc');
    });
    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual(['locMostrarDetalle', 'locOrden']);
    });
    expect(api.callsTo('GET /variables').length).toBe(before + 1);
    expect(api.callsTo('GET /variables').at(-1)?.options.query).toMatchObject({ q: 'loc' });
  });

  it('sorts by the whitelisted columns and toggles the direction', async () => {
    const user = setupUser();
    const { router, api } = await renderVariables();
    const grid = await table();
    expect(within(grid).getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await user.click(within(grid).getByRole('button', { name: 'Sort by Name' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?sort=-name');
    });
    await waitFor(() => {
      expect(ROW_NAMES(grid)[0]).toBe('locOrden');
    });
    expect(within(grid).getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    await user.click(within(grid).getByRole('button', { name: 'Sort by Updated' }));
    await waitFor(() => {
      expect(api.callsTo('GET /variables').at(-1)?.options.query).toMatchObject({
        sort: 'updatedAt',
      });
    });
    await user.click(within(grid).getByRole('button', { name: 'Sort by Scope' }));
    await waitFor(() => {
      expect(api.callsTo('GET /variables').at(-1)?.options.query).toMatchObject({ sort: 'scope' });
    });
  });

  it('pages through the results and changes the page size, going back to page 1', async () => {
    const user = setupUser();
    const many = Array.from({ length: 45 }, (_, index) =>
      makeVariable(100 + index, `v${String(index).padStart(2, '0')}`),
    );
    const { router } = await renderVariables({ variables: many });
    const grid = await table();
    await screen.findByText('Showing 1–20 of 45');

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Showing 21–40 of 45');
    expect(router.state.location.search).toBe('?page=2');
    expect(ROW_NAMES(grid)[0]).toBe('v20');

    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');
    await screen.findByText('Showing 1–45 of 45');
    expect(router.state.location.search).toBe('?pageSize=50');
  });

  it('restores filters, sort and page from a shared URL and ignores invalid values', async () => {
    const { api } = await renderVariables({
      path: '/variables?scope=CONTEXT&sort=-updatedAt&pageSize=50&dataType=BOOLEAN',
    });
    await table();

    expect(screen.getByRole('radio', { name: 'Context' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Data type' })).toHaveValue('BOOLEAN');
    expect(screen.getByLabelText('Rows per page')).toHaveValue('50');
    await waitFor(() => {
      expect(
        api.callsTo('GET /variables').some((c) => c.options.query?.sort === '-updatedAt'),
      ).toBe(true);
    });
  });

  it('falls back to the defaults for values the contract does not allow', async () => {
    const { api } = await renderVariables({
      path: '/variables?scope=NOPE&sort=password&pageSize=7&page=-3&untraced=maybe',
    });
    await table();

    await waitFor(() => {
      expect(api.callsTo('GET /variables')[0]?.options.query).toEqual({
        applicationId: 1,
        page: 1,
        pageSize: 20,
        sort: 'name',
      });
    });
  });

  it('shows a skeleton only after 300 ms and keeps the slow-answer notice for later', async () => {
    const { api, container } = await renderVariables();
    await table();
    await waitFor(() => {
      expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
    });
    const gate = api.hold(
      (call) => call.path === '/variables' && call.options.query?.scope === 'GLOBAL',
    );

    await setupUser().click(screen.getByRole('radio', { name: 'Global' }));
    expect(container.querySelectorAll('tr[aria-hidden="true"]')).toHaveLength(0);

    await waitFor(
      () => {
        expect(container.querySelectorAll('tr[aria-hidden="true"]')).toHaveLength(5);
      },
      { timeout: 2000 },
    );
    expect(screen.getByRole('table', { name: 'Variables' })).toHaveAttribute('aria-busy', 'true');

    gate.release();
    await waitFor(() => {
      expect(container.querySelectorAll('tr[aria-hidden="true"]')).toHaveLength(0);
    });
  });

  it('never lets a slow answer of a previous filter replace the current one', async () => {
    const user = setupUser();
    const { api } = await renderVariables();
    const grid = await table();
    await waitFor(() => {
      expect(ROW_NAMES(grid)).toHaveLength(5);
    });
    const slow = api.hold(
      (call) => call.path === '/variables' && call.options.query?.scope === 'GLOBAL',
    );

    await user.click(screen.getByRole('radio', { name: 'Global' }));
    await user.click(screen.getByRole('radio', { name: 'Context' }));
    await waitFor(() => {
      expect(ROW_NAMES(grid)).toEqual(['locMostrarDetalle', 'locOrden']);
    });
    slow.release();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(ROW_NAMES(grid)).toEqual(['locMostrarDetalle', 'locOrden']);
  });

  it('says there are no variables yet when the application has none', async () => {
    await renderVariables({ variables: [] });

    expect(await screen.findByRole('heading', { name: 'No variables yet' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('offers to clear the filters when they leave no results', async () => {
    const user = setupUser();
    const { router } = await renderVariables({ path: '/variables?dataType=GUID' });

    expect(await screen.findByRole('heading', { name: 'No results' })).toBeInTheDocument();
    // The empty state offers it; the header of the list card only shows it while there are rows.
    const clear = screen.getAllByRole('button', { name: 'Clear filters' });
    expect(clear).toHaveLength(1);
    await user.click(clear[0] as HTMLElement);

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await screen.findByRole('link', { name: 'gUsuario' })).toBeInTheDocument();
  });

  it('shows the server error with a retry', async () => {
    const user = setupUser();
    const { api } = await renderVariables();
    await table();
    api.failNext(
      'GET /variables',
      new ApiError({ status: 500, code: 'INTERNAL_ERROR', requestId: 'req-9' }),
    );
    await user.click(screen.getByRole('radio', { name: 'Global' }));

    expect(await screen.findByText('Something went wrong on our side')).toBeInTheDocument();
    expect(screen.getByText('req-9')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('link', { name: 'gUsuario' })).toBeInTheDocument();
  });

  it('starts over when the application changes', async () => {
    const user = setupUser();
    const { router } = await renderVariables({
      path: '/variables?scope=GLOBAL&page=1&sort=-name',
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
    });
    await table();
    expect(router.state.location.search).toContain('scope=GLOBAL');

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await screen.findByRole('heading', { name: 'No variables yet' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
  });

  it('says the application is read-only when it is archived', async () => {
    await renderVariables({
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });

    expect(await screen.findByText('Read-only: the application is archived.')).toBeInTheDocument();
  });

  it('gives the Reader the list without row actions', async () => {
    await renderVariables({ role: 'READER' });
    const grid = await table();

    await screen.findByText('gUsuario');
    expect(within(grid).queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New variable' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).not.toBeInTheDocument();
    expect(sampleVariables()).toHaveLength(5);
  });
});
