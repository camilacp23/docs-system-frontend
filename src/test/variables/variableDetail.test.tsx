// Variable detail (S-11): data, environments with notes, origin screen, "where it is used" from the dependencies,
// empty arrays, partial failure, not found, the application of the variable (D-78) and the buttons by role.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { VariableDependencies } from '../../modules/variables/variableTypes';
import { makeVariable } from '../helpers/fakeVariablesApi';
import { makeApplication } from '../helpers/renderApp';
import {
  APP_SCREEN,
  SCREEN_DETALLE,
  SCREEN_INICIO,
  renderVariables,
  sampleVariables,
  type RenderVariablesOptions,
} from '../helpers/renderVariables';
import { setupUser } from '../helpers/setupUser';

const GUSUARIO_DEPENDENCIES: VariableDependencies = {
  variable: { id: 1, name: 'gUsuario' },
  originScreen: { id: APP_SCREEN.id, name: 'App (OnStart)' },
  screens: [
    { screen: { id: SCREEN_INICIO.id, name: 'Inicio' }, accessMode: 'READ', usedIn: 'OnVisible' },
    {
      screen: { id: SCREEN_DETALLE.id, name: 'Detalle' },
      accessMode: 'READ',
      usedIn: 'lblNombre.Text',
    },
  ],
  collections: [
    {
      id: 1,
      variable: { id: 1, name: 'gUsuario' },
      collection: { id: 20, name: 'colUsuarios' },
      screen: { id: APP_SCREEN.id, name: 'App (OnStart)' },
      assignmentFunction: 'SET',
      tableFunction: 'First',
      usedIn: 'OnStart',
    },
  ],
  components: [
    {
      component: { id: 30, name: 'btnGuardar' },
      screen: { id: SCREEN_DETALLE.id, name: 'Detalle' },
      description: 'Writes the current user as author.',
    },
  ],
};

const open = (path = '/variables/1', extra: Partial<RenderVariablesOptions> = {}) =>
  renderVariables({ path, dependencies: { 1: GUSUARIO_DEPENDENCIES }, ...extra });

describe('variable detail', () => {
  it('shows the data, the environments with their notes and the origin screen', async () => {
    await open();

    expect(await screen.findByRole('heading', { name: 'gUsuario', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Updated 2026-10-03 09:14')).toBeInTheDocument();
    const details = within(screen.getByRole('region', { name: 'Details' }));
    expect(details.getByText('Record')).toBeInTheDocument();
    expect(details.getByText('Global (Set)')).toBeInTheDocument();
    expect(details.getByRole('link', { name: 'App (OnStart)' })).toHaveAttribute(
      'href',
      '/screens/10',
    );
    expect(details.getByText('Signed-in user record, loaded at start.')).toBeInTheDocument();
    expect(details.getByText('No known differences.')).toBeInTheDocument();
    expect(details.getByText('Loaded from the production user list.')).toBeInTheDocument();
  });

  it('shows where the variable is used: screens with the origin row, collections and components', async () => {
    await open();
    await screen.findByRole('heading', { name: 'gUsuario', level: 1 });

    const screens = within(await screen.findByRole('table', { name: 'Screens' }));
    const originRow = screens
      .getByRole('link', { name: 'App (OnStart)' })
      .closest('tr') as HTMLElement;
    expect(within(originRow).getByText('Origin')).toBeInTheDocument();
    expect(within(originRow).getByText('Write')).toBeInTheDocument();
    expect(within(originRow).getByText('origin')).toBeInTheDocument();
    const inicio = screens.getByRole('link', { name: 'Inicio' }).closest('tr') as HTMLElement;
    expect(within(inicio).getByText('Read')).toBeInTheDocument();
    expect(within(inicio).getByText('OnVisible')).toBeInTheDocument();
    expect(screens.getByText('lblNombre.Text')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Screens' })).getByText('3'),
    ).toBeInTheDocument();

    const collections = within(screen.getByRole('table', { name: 'Fed from collections' }));
    expect(collections.getByRole('link', { name: 'colUsuarios' })).toHaveAttribute(
      'href',
      '/collections/20',
    );
    expect(collections.getByText('Set')).toBeInTheDocument();
    expect(collections.getByText('First')).toBeInTheDocument();
    expect(collections.getByText('OnStart')).toBeInTheDocument();
    expect(collections.getByRole('link', { name: 'App (OnStart)' })).toHaveAttribute(
      'href',
      '/screens/10',
    );

    const components = within(screen.getByRole('table', { name: 'Used by components' }));
    expect(components.getByText('btnGuardar')).toBeInTheDocument();
    expect(components.getByRole('link', { name: 'Detalle' })).toHaveAttribute(
      'href',
      '/screens/12',
    );
    expect(components.getByText('Writes the current user as author.')).toBeInTheDocument();
    // The link opens the map focused on this variable (frame flow 4: variable, then focus on the node).
    expect(screen.getByRole('link', { name: 'Open in dependency map' })).toHaveAttribute(
      'href',
      '/dependency-map?focus=variable:1',
    );
  });

  it('writes the identifiers and the usedIn values in IBM Plex Mono', async () => {
    await open();
    const screens = within(await screen.findByRole('table', { name: 'Screens' }));

    expect(screens.getByRole('link', { name: 'Inicio' })).toHaveClass('font-mono');
    expect(screens.getByText('OnVisible')).toHaveClass('font-mono');
  });

  it('shows a message for each empty list and the untraced tag', async () => {
    await open('/variables/3');

    expect(
      await screen.findByRole('heading', { name: 'gRegistroSel', level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByText('No screen uses this variable yet.')).toBeInTheDocument();
    expect(screen.getByText('No collection feeds this variable.')).toBeInTheDocument();
    expect(screen.getByText('No component uses this variable.')).toBeInTheDocument();
    const details = within(screen.getByRole('region', { name: 'Details' }));
    expect(details.getByText('Untraced')).toBeInTheDocument();
    expect(details.getByText('No description.')).toBeInTheDocument();
  });

  it('shows the origin as the only screen when nothing else uses the variable', async () => {
    await renderVariables({ path: '/variables/2' });

    const screens = within(await screen.findByRole('table', { name: 'Screens' }));
    expect(screens.getAllByRole('row')).toHaveLength(2);
    expect(screens.getByText('Origin')).toBeInTheDocument();
  });

  it('keeps the page when only the dependencies fail and recovers with Try again', async () => {
    const user = setupUser();
    await open('/variables/1', {
      prepare: (api) => {
        api.failNext(
          'GET /variables/{id}/dependencies',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR', requestId: 'req-3' }),
        );
      },
    });

    expect(await screen.findByRole('heading', { name: 'gUsuario', level: 1 })).toBeInTheDocument();
    expect(
      await screen.findByText("Couldn't load where this variable is used."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Something went wrong on our side. Try again in a moment. Reference: req-3./,
      ),
    ).toBeInTheDocument();
    // The Details card still works.
    expect(
      within(screen.getByRole('region', { name: 'Details' })).getByText('Record'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('table', { name: 'Screens' })).toBeInTheDocument();
    expect(
      screen.queryByText("Couldn't load where this variable is used."),
    ).not.toBeInTheDocument();
  });

  it('says the variable does not exist for an unknown or invalid id', async () => {
    const user = setupUser();
    const { router } = await renderVariables({ path: '/variables/999' });

    expect(
      await screen.findByRole('heading', { name: "This variable doesn't exist" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to Variables' }));
    expect(router.state.location.pathname).toBe('/variables');
  });

  it('does not even ask the API for an id that is not a number', async () => {
    const { api } = await renderVariables({ path: '/variables/abc' });

    expect(
      await screen.findByRole('heading', { name: "This variable doesn't exist" }),
    ).toBeInTheDocument();
    expect(api.callsTo('GET /variables/{id}')).toHaveLength(0);
  });

  it('shows the server error with a retry', async () => {
    const user = setupUser();
    await open('/variables/1', {
      prepare: (api) => {
        api.failNext(
          'GET /variables/{id}',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR', requestId: 'req-5' }),
        );
      },
    });

    expect(await screen.findByText('Something went wrong on our side')).toBeInTheDocument();
    expect(screen.getByText('req-5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'gUsuario', level: 1 })).toBeInTheDocument();
  });

  it('puts the name in the breadcrumb', async () => {
    await open();

    await screen.findByRole('heading', { name: 'gUsuario', level: 1 });
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(await within(breadcrumb).findByText('gUsuario')).toHaveAttribute('aria-current', 'page');
    expect(within(breadcrumb).getByRole('link', { name: 'Variables' })).toHaveAttribute(
      'href',
      '/variables',
    );
  });

  it('shows Edit to Administrator and Developer, as a link to the edit page', async () => {
    await open();

    const edit = await screen.findByRole('link', { name: 'Edit' });
    expect(edit).toHaveAttribute('href', '/variables/1/edit');
  });

  it('gives the Reader the detail without Edit', async () => {
    await open('/variables/1', { role: 'READER' });

    await screen.findByRole('heading', { name: 'gUsuario', level: 1 });
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('disables Edit with the reason when the application is archived', async () => {
    await open('/variables/1', {
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });

    await screen.findByRole('heading', { name: 'gUsuario', level: 1 });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute(
      'title',
      'Read-only: the application is archived.',
    );
  });

  it('shows a skeleton only after 300 ms while the variable loads', async () => {
    let gate: { release: () => void } | undefined;
    await open('/variables/1', {
      prepare: (api) => {
        gate = api.hold((call) => call.method === 'GET' && call.path === '/variables/{id}');
      },
    });

    expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument();
    expect(
      await screen.findByRole('status', { name: 'Loading' }, { timeout: 2000 }),
    ).toBeInTheDocument();

    gate?.release();
    expect(await screen.findByRole('heading', { name: 'gUsuario', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument();
  });

  it('selects the application of the variable when its link is opened (D-78) and says so', async () => {
    const other = makeVariable(7, 'bFactura', { applicationId: 2 });
    const { router } = await renderVariables({
      path: '/variables/7',
      variables: [...sampleVariables(), other],
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
    });

    expect(await screen.findByText('Switched to Billing.')).toBeInTheDocument();
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByText('Billing')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/variables/7');
  });

  it('does not announce a switch when the variable belongs to the selected application', async () => {
    await open();

    await screen.findByRole('heading', { name: 'gUsuario', level: 1 });
    expect(screen.queryByText(/Switched to/)).not.toBeInTheDocument();
  });

  it('goes back to the list when the application is switched from the shell', async () => {
    const user = setupUser();
    const { router } = await renderVariables({
      path: '/variables/1',
      dependencies: { 1: GUSUARIO_DEPENDENCIES },
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
    });
    await screen.findByRole('heading', { name: 'gUsuario', level: 1 });

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/variables');
    });
  });
});
