// Dependency map page (S-27, S-28): the graph of the selected application, the filters and the focus in the URL, the
// nodes with their tags, the reload when the application changes, and the loading, empty, error and not-found states.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { collectionNode, sampleGraph, screenNode, variableNode } from '../helpers/graphFixtures';
import { makeApplication } from '../helpers/renderApp';
import { renderMap, type RenderMapOptions } from '../helpers/renderMap';
import { setupUser } from '../helpers/setupUser';

/** These tests are about the whole graph, which the All elements view draws; the default view is Screens. */
const renderAll = (options: RenderMapOptions = {}) =>
  renderMap({ path: '/dependency-map?view=all', ...options });

const node = (name: string) => screen.findByRole('button', { name });
/** The cards of the Screens view say their counters in their accessible name. */
const INICIO_CARD = 'Screen Inicio, Approved, 1 component, 1 variable, 1 collection';
const DETALLE_CARD = 'Screen Detalle, In review, 2 components, 2 variables, 1 collection';

describe('dependency map: the graph', () => {
  it('reads the graph of the selected application and draws one button per node', async () => {
    const { api } = await renderAll();

    expect(await node('Screen Inicio, Approved')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dependency map', level: 1 })).toBeVisible();
    expect(screen.getByText('13 elements · 18 relationships')).toBeInTheDocument();
    const calls = api.callsTo('GET /dependencies/graph');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.options.query).toEqual({ applicationId: 1 });
    // One button per node: 3 screens, 4 variables, 3 collections and 3 components.
    const canvas = screen.getByRole('region', { name: 'Dependency graph' });
    expect(
      within(canvas).getAllByRole('button', { name: /^(Screen|Variable|Collection|Component) / }),
    ).toHaveLength(13);
  });

  it('draws the status tag of a screen, "Reserved" on App (OnStart) and the dashed untraced variable', async () => {
    await renderAll();

    const app = await node('Screen App (OnStart), In progress, Reserved');
    expect(within(app).getByText('In progress')).toBeInTheDocument();
    expect(within(app).getByText('Reserved')).toBeInTheDocument();
    expect(
      within(await node('Screen Detalle, In review')).getByText('In review'),
    ).toBeInTheDocument();
    const untraced = await node('Variable gRegistroSel, Global, untraced');
    expect(within(untraced).getByText('Untraced')).toBeInTheDocument();
    expect(untraced).toHaveClass('border-dashed');
    expect(await node('Variable gUsuario, Global')).not.toHaveClass('border-dashed');
    expect(
      within(await node('Variable locMostrarDetalle, Context')).getByText('Context'),
    ).toBeInTheDocument();
  });

  it('cuts a long name with "…" and keeps the full name in the accessible name and the tooltip', async () => {
    const long = 'locMostrarDetalleDelClienteSeleccionado';
    await renderAll({
      graphs: { 1: { nodes: [screenNode(1, 'Inicio'), variableNode(5, long)], edges: [] } },
    });

    const button = await node(`Variable ${long}, Global`);
    expect(button).toHaveAttribute('title', long);
    expect(within(button).getByText(/…$/)).toBeInTheDocument();
    expect(within(button).queryByText(long)).not.toBeInTheDocument();
  });

  it('draws the legend of the relationships with one sample line per kind, and the mini map and the zoom controls', async () => {
    await renderAll();
    await node('Screen Inicio, Approved');

    const legend = screen.getByRole('region', { name: 'Relationships' });
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Contains', 'Creates', 'Accesses', 'Feeds', 'Uses', 'Derives from', 'Navigates to']);
    expect(screen.getByRole('img', { name: 'Minimap' })).toBeInTheDocument();
    for (const name of ['Zoom In', 'Zoom Out', 'Fit View']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('lets every role open it, the Reader included', async () => {
    await renderAll({ role: 'READER' });

    expect(await node('Screen Inicio, Approved')).toBeInTheDocument();
  });

  it('reads an archived application like any other', async () => {
    const { api } = await renderAll({
      applications: [makeApplication(1, { name: 'SAR', status: 'ARCHIVED' })],
    });

    expect(await node('Screen Inicio, Approved')).toBeInTheDocument();
    expect(api.callsTo('GET /dependencies/graph')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /New|Edit|Delete/ })).not.toBeInTheDocument();
  });
});

describe('dependency map: filters in the URL', () => {
  it('sends the types as a list and keeps them in the URL; the default (every type) leaves no parameter', async () => {
    const user = setupUser();
    const { api, router } = await renderAll();
    await node('Screen Inicio, Approved');

    await user.click(screen.getByRole('checkbox', { name: 'Components' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('?view=all&types=SCREEN%2CVARIABLE%2CCOLLECTION');
    });
    await waitFor(() => {
      expect(api.callsTo('GET /dependencies/graph')).toHaveLength(2);
    });
    expect(api.callsTo('GET /dependencies/graph')[1]?.options.query).toEqual({
      applicationId: 1,
      types: ['SCREEN', 'VARIABLE', 'COLLECTION'],
    });
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Component btnGuardar' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText('10 elements · 13 relationships')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Components' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?view=all');
    });
    expect(await node('Component btnGuardar')).toBeInTheDocument();
  });

  it('reads the types of the URL on load', async () => {
    const { api } = await renderAll({ path: '/dependency-map?view=all&types=VARIABLE,COLLECTION' });

    expect(await node('Collection colClientes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Screen / })).not.toBeInTheDocument();
    expect(api.callsTo('GET /dependencies/graph')[0]?.options.query).toEqual({
      applicationId: 1,
      types: ['VARIABLE', 'COLLECTION'],
    });
    expect(screen.getByRole('checkbox', { name: 'Screens' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Variables' })).toBeChecked();
  });

  it('does not let the last type be cleared: an empty list would mean every type', async () => {
    await renderAll({ path: '/dependency-map?view=all&types=COLLECTION' });
    await node('Collection colClientes');

    expect(screen.getByRole('checkbox', { name: 'Collections' })).toBeDisabled();
  });

  it('sends the environment and keeps it in the URL', async () => {
    const user = setupUser();
    const { api, router } = await renderAll({
      environments: { 'variable:2': ['PROD'], 'collection:22': ['DEV'] },
    });
    await node('Screen Inicio, Approved');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Environment' }), 'DEV');

    await waitFor(() => {
      expect(router.state.location.search).toBe('?view=all&environment=DEV');
    });
    await waitFor(() => {
      expect(api.callsTo('GET /dependencies/graph')[1]?.options.query).toEqual({
        applicationId: 1,
        environment: 'DEV',
      });
    });
    // Only variables and collections are filtered by the environment: the screens and components stay.
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Variable gFiltroActivo, Global' }),
      ).not.toBeInTheDocument();
    });
    expect(await node('Collection colActivos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Screen Inicio, Approved' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Component btnGuardar' })).toBeInTheDocument();
  });

  it('shows only the untraced variables and their direct neighbors, with the edges between them', async () => {
    const user = setupUser();
    const { api, router } = await renderAll();
    await node('Screen Inicio, Approved');

    await user.click(screen.getByRole('button', { name: 'Show untraced only' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('?view=all&untraced=1');
    });
    expect(screen.getByRole('button', { name: 'Show untraced only' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Screen Inicio, Approved' }),
      ).not.toBeInTheDocument();
    });
    expect(await node('Variable gRegistroSel, Global, untraced')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collection colClientes' })).toBeInTheDocument();
    expect(screen.getByText('2 elements · 1 relationship')).toBeInTheDocument();
    // A filter of the client: the API is not asked again.
    expect(api.callsTo('GET /dependencies/graph')).toHaveLength(1);
  });

  it('says "No results" with "Clear filters" when the filters leave nothing', async () => {
    const user = setupUser();
    const graph = {
      nodes: [screenNode(1, 'Inicio'), variableNode(2, 'gA')],
      edges: [],
    };
    const { router } = await renderAll({
      graphs: { 1: graph },
      path: '/dependency-map?view=all&untraced=1',
    });

    expect(await screen.findByText('No results')).toBeVisible();
    expect(screen.getByText('No elements match these filters.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?view=all');
    });
    expect(await node('Variable gA, Global')).toBeInTheDocument();
  });

  it('"Reset view" drops every filter and the focus', async () => {
    const user = setupUser();
    const { router } = await renderAll({
      path: '/dependency-map?view=all&types=SCREEN,VARIABLE&environment=PROD&untraced=1',
    });
    await screen.findByRole('checkbox', { name: 'Screens' });

    await user.click(screen.getByRole('button', { name: 'Reset view' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await node(INICIO_CARD)).toBeInTheDocument();
  });
});

describe('dependency map: focus on a node', () => {
  it('reads the neighborhood with the depth, keeps both in the URL and goes back to the full map', async () => {
    const user = setupUser();
    const { api, router } = await renderAll({ path: '/dependency-map?focus=variable:1' });

    const banner = await screen.findByRole('region', { name: 'Focus' });
    expect(within(banner).getByText('gUsuario')).toBeInTheDocument();
    const call = api.callsTo('GET /dependencies/{type}/{id}')[0];
    expect(call?.options.path).toEqual({ type: 'variables', id: 1 });
    expect(call?.options.query).toEqual({ depth: 1 });
    expect(api.callsTo('GET /dependencies/graph')).toHaveLength(0);
    // Depth 1 around gUsuario: its screens, the collection that feeds it and the component that uses it.
    expect(await node('Variable gUsuario, Global')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collection colActivos' })).not.toBeInTheDocument();

    await user.click(within(banner).getByRole('radio', { name: '2' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?focus=variable%3A1&depth=2');
    });
    await waitFor(() => {
      expect(api.callsTo('GET /dependencies/{type}/{id}')[1]?.options.query).toEqual({ depth: 2 });
    });
    // Two steps reach colClientes (through Inicio), three would be needed for colActivos.
    expect(await node('Collection colClientes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collection colActivos' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show full map' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await node(DETALLE_CARD)).toBeInTheDocument();
    expect(api.callsTo('GET /dependencies/graph')).toHaveLength(1);
  });

  it('opens the focus from the panel of a node ("Focus on this node")', async () => {
    const user = setupUser();
    const { api, router } = await renderAll();

    await user.click(await node('Screen Detalle, In review'));
    await user.click(screen.getByRole('button', { name: 'Focus on this node' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('?view=all&focus=screen%3A12');
    });
    expect(await screen.findByRole('region', { name: 'Focus' })).toBeVisible();
    await waitFor(() => {
      expect(api.callsTo('GET /dependencies/{type}/{id}')[0]?.options.path).toEqual({
        type: 'screens',
        id: 12,
      });
    });
    // The focused node has no "Focus on this node": it is already the focus (frame S-28).
    expect(await screen.findByRole('complementary', { name: 'Selected element' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Focus on this node' })).not.toBeInTheDocument();
  });

  it('shows "This element doesn\'t exist" for a focus that does not exist, and goes back to the map', async () => {
    const user = setupUser();
    const { router } = await renderAll({ path: '/dependency-map?focus=variable:999' });

    expect(await screen.findByText("This element doesn't exist")).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Back to Dependency map' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await node(INICIO_CARD)).toBeInTheDocument();
  });

  it('ignores a focus that is not a node key', async () => {
    const { api } = await renderAll({ path: '/dependency-map?focus=banana&depth=9' });

    expect(await node(INICIO_CARD)).toBeInTheDocument();
    expect(api.callsTo('GET /dependencies/{type}/{id}')).toHaveLength(0);
  });
});

describe('dependency map: application', () => {
  const second = {
    nodes: [screenNode(50, 'Facturas'), collectionNode(60, 'colFacturas')],
    edges: [],
  };

  it('reloads the map when the application is changed in the sidebar', async () => {
    const user = setupUser();
    const { api } = await renderAll({
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
      graphs: { 1: sampleGraph(), 2: second },
    });
    await node('Screen Inicio, Approved');

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    expect(await node('Screen Facturas, Draft')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Screen Inicio, Approved' }),
    ).not.toBeInTheDocument();
    const queries = api.callsTo('GET /dependencies/graph').map((call) => call.options.query);
    expect(queries).toEqual([{ applicationId: 1 }, { applicationId: 2 }]);
  });

  it('drops the focus and the selection when the application changes (the element belongs to the other one)', async () => {
    const user = setupUser();
    const { router } = await renderAll({
      path: '/dependency-map?view=all&focus=variable:1&types=VARIABLE,COLLECTION',
      applications: [makeApplication(1, { name: 'SAR' }), makeApplication(2, { name: 'Billing' })],
      graphs: { 1: sampleGraph(), 2: second },
    });
    await user.click(await node('Variable gUsuario, Global'));
    expect(await screen.findByRole('complementary', { name: 'Selected element' })).toBeVisible();

    await user.click(await screen.findByRole('button', { name: 'Switch application' }));
    await user.click(screen.getByRole('button', { name: 'Billing' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('?view=all&types=VARIABLE%2CCOLLECTION');
    });
    expect(
      screen.queryByRole('complementary', { name: 'Selected element' }),
    ).not.toBeInTheDocument();
    expect(await node('Collection colFacturas')).toBeInTheDocument();
  });

  it('says "This application doesn\'t exist" when the API does not know the application', async () => {
    await renderAll({ graphs: {} });

    expect(await screen.findByText("This application doesn't exist")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Back to Dashboard' })).toBeVisible();
  });
});

describe('dependency map: states', () => {
  it('shows a skeleton only after 300 ms, while the graph is loading', async () => {
    const { api } = await renderAll({
      settled: false,
      prepare: (fake) => {
        fake.hold((call) => call.path === '/dependencies/graph');
      },
    });
    expect(api.callsTo('GET /dependencies/graph').length).toBeLessThanOrEqual(1);

    expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Screen / })).not.toBeInTheDocument();
  });

  it('says "Nothing to map yet" when the application has only App (OnStart)', async () => {
    await renderAll({
      graphs: {
        1: {
          nodes: [
            screenNode(10, 'App (OnStart)', {
              isAppContext: true,
              documentationStatus: 'UNDOCUMENTED',
            }),
          ],
          edges: [],
        },
      },
    });

    expect(await screen.findByText('Nothing to map yet')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Dependency graph' })).not.toBeInTheDocument();
  });

  it('shows the failure inside the block, without breaking the page, and reads again with "Try again"', async () => {
    const user = setupUser();
    const { api } = await renderAll({
      prepare: (fake) => {
        fake.failNext(
          'GET /dependencies/graph',
          new ApiError({ status: 500, code: 'INTERNAL_ERROR' }),
        );
      },
    });

    expect(await screen.findByText("Couldn't load the dependency map.")).toBeVisible();
    // The page around the block keeps working: title, filters and sidebar.
    expect(screen.getByRole('heading', { name: 'Dependency map', level: 1 })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Screens' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await node('Screen Inicio, Approved')).toBeInTheDocument();
    expect(api.callsTo('GET /dependencies/graph')).toHaveLength(2);
  });
});
