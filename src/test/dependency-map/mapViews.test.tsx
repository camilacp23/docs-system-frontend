// The three views of the map (D-114): Screens (the default), focus and All elements, with their filters and reasons, the
// notice past 60 nodes, the trail of the focus view and the highlight of a hovered, focused or selected node.
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  accesses,
  collectionNode,
  componentNode,
  makeLargeGraph,
  navigates,
  sampleGraph,
  screenNode,
} from '../helpers/graphFixtures';
import { renderMap } from '../helpers/renderMap';
import { setupUser } from '../helpers/setupUser';

const button = (name: string | RegExp) => screen.findByRole('button', { name });
const INICIO = 'Screen Inicio, Approved, 1 component, 1 variable, 1 collection';
const DETALLE = 'Screen Detalle, In review, 2 components, 2 variables, 1 collection';
const APP = 'Screen App (OnStart), In progress, Reserved, 0 components, 2 variables, 0 collections';
const edgeCount = () => document.querySelectorAll('.react-flow__edge').length;
const wrapperOf = (element: HTMLElement) => element.parentElement as HTMLElement;
const isDimmed = (element: HTMLElement) => wrapperOf(element).classList.contains('opacity-25');

describe('Screens view (the default)', () => {
  it('draws only the screens, as cards with their counters, and only the navigation between them', async () => {
    const { api } = await renderMap();

    expect(await button(INICIO)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: DETALLE })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: APP })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^(Variable|Collection|Component) / })).toBeNull();
    expect(edgeCount()).toBe(1); // Inicio navigates to Detalle
    expect(screen.getByText('3 screens · 1 navigation')).toBeInTheDocument();
    // The counters are in the card, as numbers with their icons and as words for a screen reader.
    const inicio = screen.getByRole('button', { name: INICIO });
    expect(within(inicio).getByText('1 component')).toHaveClass('sr-only');
    expect(within(inicio).getByText('Approved')).toBeInTheDocument();
    // The Screens view needs every type for its counters: it never sends `types`.
    expect(api.callsTo('GET /dependencies/graph')[0]?.options.query).toEqual({ applicationId: 1 });
  });

  it('leaves no view parameter in the URL, and keeps the type filters off with the reason', async () => {
    const { router } = await renderMap({ path: '/dependency-map?types=SCREEN' });
    await button(/^Screen Inicio/);

    expect(router.state.location.search).toBe('?types=SCREEN');
    expect(screen.getByRole('radio', { name: 'Screens' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Components' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show untraced only' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show untraced only' })).toHaveAttribute(
      'title',
      'Available in the All elements view.',
    );
    // The environment applies to the counters, so it stays available.
    expect(screen.getByRole('combobox', { name: 'Environment' })).toBeEnabled();
  });

  it('switches to All elements and back, keeping the view in the URL', async () => {
    const user = setupUser();
    const { router, api } = await renderMap();
    await button(INICIO);

    await user.click(screen.getByRole('radio', { name: 'All elements' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('?view=all');
    });
    expect(await button('Component btnGuardar')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Components' })).toBeEnabled();
    expect(screen.getByText('13 elements · 18 relationships')).toBeInTheDocument();
    expect(api.callsTo('GET /dependencies/graph')).toHaveLength(1); // the same answer, the types are not filtered

    await user.click(screen.getByRole('radio', { name: 'Screens' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await button(INICIO)).toBeInTheDocument();
  });

  it('opens the focus view when a connection that this view does not draw is chosen in the panel', async () => {
    const user = setupUser();
    const { router } = await renderMap();

    await user.click(await button(INICIO));
    const panel = within(await screen.findByRole('complementary', { name: 'Selected element' }));
    await user.click(panel.getByRole('button', { name: /gUsuario/ }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('?focus=variable%3A1');
    });
    expect(await screen.findByRole('region', { name: 'Focus' })).toBeVisible();
  });

  it('selects a screen that is drawn, from the search, and focuses on one that is not', async () => {
    const user = setupUser();
    const { router } = await renderMap();
    await button(INICIO);

    const search = screen.getByRole('combobox', { name: 'Find a node' });
    await user.click(search);
    await user.keyboard('Inici{ArrowDown}{Enter}');
    expect(
      (await screen.findByRole('complementary', { name: 'Selected element' })).querySelector('h2'),
    ).toHaveTextContent('Inicio');
    expect(router.state.location.search).toBe('');

    await user.clear(search);
    await user.keyboard('colUsu{ArrowDown}{Enter}');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?focus=collection%3A20');
    });
  });

  it('counts the variable a screen only creates', async () => {
    await renderMap({
      graphs: {
        1: {
          nodes: [
            screenNode(10, 'App (OnStart)', { isAppContext: true }),
            ...sampleGraph().nodes.filter((node) => node.key === 'variable:2'),
          ],
          edges: sampleGraph().edges.filter((edge) => edge.id === 'cr:2'),
        },
      },
    });

    expect(
      await button(
        'Screen App (OnStart), Draft, Reserved, 0 components, 1 variable, 0 collections',
      ),
    ).toBeInTheDocument();
  });

  it('draws a 500-element application as 40 screens, App (OnStart) first, not as a strip', async () => {
    await renderMap({ graphs: { 1: makeLargeGraph(500) } });

    expect(await screen.findByText('40 screens · 39 navigations')).toBeInTheDocument();
    const app = await button(/^Screen App \(OnStart\)/);
    expect(app).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Dependency graph' })).toBeVisible();
  });
});

describe('All elements view', () => {
  it('draws a screen with components as a group that holds them, without containment edges', async () => {
    await renderMap({ path: '/dependency-map?view=all' });

    expect(await button('Screen Detalle, In review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Component btnGuardar' })).toBeInTheDocument();
    // 18 edges in the graph, 3 of them CONTAINS: 15 are drawn.
    await waitFor(() => {
      expect(edgeCount()).toBe(15);
    });
  });

  it('keeps every line below every box, also the lines that end at a component inside a group', async () => {
    await renderMap({ path: '/dependency-map?view=all' });
    await button('Component btnGuardar');

    // React Flow lifts a line to the level of the component it ends at unless the z-index is manual: that put it over
    // the boxes of other screens and crossed their text.
    await waitFor(() => {
      expect(edgeCount()).toBeGreaterThan(0);
    });
    const levels = [...document.querySelectorAll('.react-flow__edge')].map(
      (edge) => (edge.parentElement as unknown as SVGElement).style.zIndex,
    );
    expect(new Set(levels)).toEqual(new Set(['0']));
    for (const node of document.querySelectorAll<HTMLElement>('.react-flow__node')) {
      expect(Number(node.style.zIndex)).toBeGreaterThanOrEqual(1);
    }
  });

  it('draws nothing past 60 nodes and says what to do instead', async () => {
    const user = setupUser();
    const { router } = await renderMap({
      path: '/dependency-map?view=all',
      graphs: { 1: makeLargeGraph(500) },
    });

    expect(await screen.findByText('Too many elements to draw at once')).toBeVisible();
    expect(
      screen.getByText(/This map has 500 elements, more than the 60 that stay readable\./),
    ).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Dependency graph' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    // The search still works: it offers every element, to focus on one.
    expect(screen.getByRole('combobox', { name: 'Find a node' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Show Screens view' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(await screen.findByText('40 screens · 39 navigations')).toBeVisible();
  });

  it('draws what is left after the filters when it is 60 nodes or fewer', async () => {
    await renderMap({
      path: '/dependency-map?view=all&untraced=1',
      graphs: { 1: makeLargeGraph(500) },
    });

    expect(await screen.findByRole('region', { name: 'Dependency graph' })).toBeVisible();
    expect(screen.queryByText('Too many elements to draw at once')).not.toBeInTheDocument();
  });

  it('offers to clear the filters in the notice when some are on', async () => {
    const user = setupUser();
    const { router } = await renderMap({
      path: '/dependency-map?view=all&types=SCREEN,VARIABLE,COLLECTION,COMPONENT&environment=DEV',
      graphs: { 1: makeLargeGraph(500) },
    });

    await screen.findByText('Too many elements to draw at once');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('?view=all');
    });
  });
});

describe('focus view', () => {
  it('shows the element in the middle in the panel, with no close button', async () => {
    await renderMap({ path: '/dependency-map?focus=variable:1' });

    const panel = within(await screen.findByRole('complementary', { name: 'Selected element' }));
    expect(panel.getByRole('heading', { name: 'gUsuario', level: 2 })).toBeVisible();
    expect(panel.queryByRole('button', { name: 'Close panel' })).not.toBeInTheDocument();
    expect(panel.queryByRole('button', { name: 'Focus on this node' })).not.toBeInTheDocument();
    expect(panel.getByRole('link', { name: 'Open variable' })).toBeVisible();
  });

  it('puts a neighbor in the middle when it is clicked, and the trail goes back', async () => {
    const user = setupUser();
    const { router, api } = await renderMap({ path: '/dependency-map?focus=variable:1' });

    await user.click(await button('Collection colUsuarios'));

    await waitFor(() => {
      expect(router.state.location.search).toBe('?focus=collection%3A20');
    });
    const trail = await screen.findByRole('navigation', { name: 'Focus path' });
    expect(within(trail).getByRole('button', { name: 'gUsuario' })).toBeVisible();
    expect(within(trail).getByText('colUsuarios')).toHaveAttribute('aria-current', 'step');
    expect(
      (await screen.findByRole('complementary', { name: 'Selected element' })).querySelector('h2'),
    ).toHaveTextContent('colUsuarios');
    expect(api.callsTo('GET /dependencies/{type}/{id}')[1]?.options.path).toEqual({
      type: 'collections',
      id: 20,
    });

    await user.click(within(trail).getByRole('button', { name: 'gUsuario' }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?focus=variable%3A1');
    });
    expect(screen.queryByRole('navigation', { name: 'Focus path' })).not.toBeInTheDocument();
  });

  it('keeps the last five steps of the trail', async () => {
    const user = setupUser();
    const names = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];
    const chain = {
      nodes: names.map((name, index) => screenNode(index + 1, name)),
      edges: names
        .slice(0, -1)
        .map((_name, index) => navigates(index + 1, `screen:${index + 1}`, `screen:${index + 2}`)),
    };
    await renderMap({ path: '/dependency-map?focus=screen:1', graphs: { 1: chain } });

    for (const next of ['s2', 's3', 's4', 's5', 's6', 's7']) {
      await user.click(await button(new RegExp(`^Screen ${next},`)));
      await screen.findByRole('heading', { name: next, level: 2 });
    }

    const trail = screen.getByRole('navigation', { name: 'Focus path' });
    expect(
      within(trail)
        .getAllByRole('listitem')
        .map((item) => item.textContent?.replace('›', '').trim()),
    ).toEqual(['s3', 's4', 's5', 's6', 's7']);
  });

  it('reads depth 3 of a link as 2, and offers depths 1 and 2', async () => {
    const { api } = await renderMap({ path: '/dependency-map?focus=variable:1&depth=3' });

    await screen.findByRole('region', { name: 'Focus' });
    expect(api.callsTo('GET /dependencies/{type}/{id}')[0]?.options.query).toEqual({ depth: 2 });
    const banner = within(screen.getByRole('region', { name: 'Focus' }));
    expect(banner.getAllByRole('radio')).toHaveLength(2);
    expect(banner.getByRole('radio', { name: '2' })).toBeChecked();
  });

  it('keeps the filters off with the reason while focused', async () => {
    await renderMap({ path: '/dependency-map?focus=variable:1&view=all' });
    await screen.findByRole('region', { name: 'Focus' });

    expect(screen.getByRole('checkbox', { name: 'Screens' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Environment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show untraced only' })).toHaveAttribute(
      'title',
      'Filters apply to the full map.',
    );
  });

  it('draws a screen with its components inside and the access modes on the lines', async () => {
    await renderMap({
      path: '/dependency-map?focus=screen:12',
      graphs: {
        1: {
          nodes: [
            screenNode(12, 'Detalle'),
            componentNode(31, 'btnGuardar', 12),
            collectionNode(21, 'colClientes'),
          ],
          edges: [
            { id: 'ct:31', source: 'screen:12', target: 'component:31', kind: 'CONTAINS' },
            accesses(1, 'screen:12', 'collection:21', 'READ', 'a'),
            accesses(2, 'screen:12', 'collection:21', 'WRITE', 'b'),
          ],
        },
      },
    });

    expect(await button('Component btnGuardar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collection colClientes' })).toBeInTheDocument();
    expect(await screen.findByText('Read · Write ×2')).toBeInTheDocument();
    await waitFor(() => {
      expect(edgeCount()).toBe(1); // the two accesses are one line; the containment is not drawn
    });
  });
});

describe('highlight', () => {
  it('dims everything but the hovered node, its neighbors and the lines between them', async () => {
    const user = setupUser();
    await renderMap({ path: '/dependency-map?view=all' });
    const colActivos = await button('Collection colActivos');
    const colClientes = screen.getByRole('button', { name: 'Collection colClientes' });
    const unrelated = screen.getByRole('button', { name: 'Variable gFiltroActivo, Global' });
    expect(isDimmed(unrelated)).toBe(false);

    await user.hover(colActivos);

    expect(isDimmed(colActivos)).toBe(false);
    expect(isDimmed(colClientes)).toBe(false);
    expect(isDimmed(unrelated)).toBe(true);
    const dimmedLines = [...document.querySelectorAll<SVGElement>('.react-flow__edge-path')].filter(
      (path) => path.style.opacity === '0.15',
    );
    expect(dimmedLines.length).toBeGreaterThan(0);
    expect(dimmedLines.length).toBeLessThan(
      document.querySelectorAll('.react-flow__edge-path').length,
    );

    await user.unhover(colActivos);
    expect(isDimmed(unrelated)).toBe(false);
  });

  it('highlights with the keyboard focus too', async () => {
    await renderMap({ path: '/dependency-map?view=all' });
    const colActivos = await button('Collection colActivos');
    const unrelated = screen.getByRole('button', { name: 'Variable gFiltroActivo, Global' });

    colActivos.focus();
    await waitFor(() => {
      expect(isDimmed(unrelated)).toBe(true);
    });
    expect(isDimmed(colActivos)).toBe(false);

    colActivos.blur();
    await waitFor(() => {
      expect(isDimmed(unrelated)).toBe(false);
    });
  });

  it('keeps the highlight of the selected node, and a hover takes over while it lasts', async () => {
    const user = setupUser();
    await renderMap({ path: '/dependency-map?view=all' });
    const colActivos = await button('Collection colActivos');
    const unrelated = screen.getByRole('button', { name: 'Variable gFiltroActivo, Global' });

    await user.click(colActivos);
    await user.unhover(colActivos);
    expect(isDimmed(unrelated)).toBe(true);

    await user.hover(unrelated);
    expect(isDimmed(unrelated)).toBe(false);
    expect(isDimmed(colActivos)).toBe(true);
  });

  it('keeps a group and its components together: hovering a component lights its screen', async () => {
    const user = setupUser();
    await renderMap({ path: '/dependency-map?view=all' });
    const component = await button('Component lblNombre');

    await user.hover(component);

    expect(isDimmed(component)).toBe(false);
    expect(isDimmed(screen.getByRole('button', { name: 'Screen Detalle, In review' }))).toBe(false);
    expect(isDimmed(screen.getByRole('button', { name: 'Variable gUsuario, Global' }))).toBe(false);
    expect(isDimmed(screen.getByRole('button', { name: 'Collection colActivos' }))).toBe(true);
  });
});
