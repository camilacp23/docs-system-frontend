// Side panel of the dependency map (S-27b, S-28) and the keyboard alternative to the canvas: the connections of a node
// with kind, access mode, usedIn and assignment function, the links to its page (a component leads to the Components &
// navigation tab of its screen, also when the types filter leaves out the screens), the Miro link only when it is
// https, the search of nodes and closing the panel.
import { screen, waitFor, within, type BoundFunctions, type queries } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { COMPONENTS_TAB } from '../../modules/screens/screenTabs';
import { MIRO_LINK, screenNode, variableNode } from '../helpers/graphFixtures';
import { renderMap } from '../helpers/renderMap';
import { setupUser } from '../helpers/setupUser';

const node = (name: string) => screen.findByRole('button', { name });
const panel = async () =>
  within(await screen.findByRole('complementary', { name: 'Selected element' }));
const section = (view: BoundFunctions<typeof queries>, title: string) =>
  within(view.getByRole('region', { name: title }));

describe('side panel: a screen', () => {
  it('opens with the name, the status, the link to its page and to its Miro diagram', async () => {
    const user = setupUser();
    await renderMap();

    const inicio = await node('Screen Inicio, Approved');
    await user.click(inicio);

    const view = await panel();
    expect(view.getByRole('heading', { name: 'Inicio', level: 2 })).toHaveFocus();
    expect(view.getByText('Screen', { selector: 'p' })).toBeInTheDocument();
    expect(view.getByText('Approved')).toBeInTheDocument();
    expect(view.getByRole('link', { name: 'Open screen' })).toHaveAttribute('href', '/screens/11');
    const miro = view.getByRole('link', { name: /Open in Miro/ });
    expect(miro).toHaveAttribute('href', MIRO_LINK);
    expect(miro).toHaveAttribute('target', '_blank');
    expect(miro.getAttribute('rel')?.split(' ')).toEqual(
      expect.arrayContaining(['noopener', 'noreferrer']),
    );
    expect(inicio).toHaveAttribute('aria-pressed', 'true');
  });

  it('lists its connections by kind, with the access mode and where it happens', async () => {
    const user = setupUser();
    await renderMap();

    await user.click(await node('Screen Inicio, Approved'));

    const view = await panel();
    const contains = section(view, 'Contains');
    expect(contains.getByRole('button', { name: /galClientes/ })).toBeInTheDocument();
    const accesses = section(view, 'Accesses');
    expect(accesses.getByRole('button', { name: /gUsuario/ })).toHaveTextContent(
      'Read · OnVisible',
    );
    expect(accesses.getByRole('button', { name: /colClientes/ })).toHaveTextContent(
      'Read · galClientes.Items',
    );
    const navigation = section(view, 'Navigation');
    expect(navigation.getByRole('button', { name: /Detalle/ })).toHaveTextContent('to');
    // Inicio creates nothing and nothing feeds it.
    expect(view.queryByRole('region', { name: 'Creates' })).not.toBeInTheDocument();
  });

  it('shows the incoming navigation as "from"', async () => {
    const user = setupUser();
    await renderMap();

    await user.click(await node('Screen Detalle, In review'));

    const navigation = section(await panel(), 'Navigation');
    expect(navigation.getByRole('button', { name: /Inicio/ })).toHaveTextContent('from');
  });

  it('has no Miro button when the screen has no diagram', async () => {
    const user = setupUser();
    await renderMap();

    await user.click(await node('Screen Detalle, In review'));

    const view = await panel();
    expect(view.getByRole('link', { name: 'Open screen' })).toBeVisible();
    expect(view.queryByRole('link', { name: /Open in Miro/ })).not.toBeInTheDocument();
  });

  it.each([
    ['http', 'http://miro.com/app/board/x/'],
    ['javascript', 'javascript:alert(1)'],
  ])('never makes a %s address a Miro link', async (_name, miroLink) => {
    const user = setupUser();
    await renderMap({
      graphs: { 1: { nodes: [screenNode(1, 'Inicio', { miroLink })], edges: [] } },
    });

    await user.click(await node('Screen Inicio, Draft'));

    const view = await panel();
    expect(view.getByRole('link', { name: 'Open screen' })).toBeVisible();
    expect(view.queryByRole('link', { name: /Open in Miro/ })).not.toBeInTheDocument();
  });

  it('marks App (OnStart) as Reserved and lists the variables it creates as "origin"', async () => {
    const user = setupUser();
    await renderMap();

    await user.click(await node('Screen App (OnStart), In progress, Reserved'));

    const view = await panel();
    expect(view.getByText('Reserved')).toBeInTheDocument();
    const creates = section(view, 'Creates');
    expect(creates.getByRole('button', { name: /gUsuario/ })).toHaveTextContent('origin');
    expect(creates.getByRole('button', { name: /gFiltroActivo/ })).toHaveTextContent('origin');
  });
});

describe('side panel: variables, collections and components', () => {
  it('shows where a variable is created, who accesses it, what feeds it and what uses it', async () => {
    const user = setupUser();
    await renderMap();

    await user.click(await node('Variable gUsuario, Global'));

    const view = await panel();
    expect(view.getByRole('link', { name: 'Open variable' })).toHaveAttribute(
      'href',
      '/variables/1',
    );
    expect(
      section(view, 'Created in').getByRole('button', { name: /App \(OnStart\)/ }),
    ).toHaveTextContent('origin');
    const accessed = section(view, 'Accessed by');
    expect(accessed.getByRole('button', { name: /Inicio/ })).toHaveTextContent('Read · OnVisible');
    expect(accessed.getByRole('button', { name: /Detalle/ })).toHaveTextContent(
      'Read · lblNombre.Text',
    );
    expect(
      section(view, 'Fed from').getByRole('button', { name: /colUsuarios/ }),
    ).toHaveTextContent('Set · First · OnStart');
    // A component that uses the variable is listed with the screen it belongs to.
    expect(section(view, 'Used by').getByRole('button', { name: /lblNombre/ })).toHaveTextContent(
      'Detalle',
    );
  });

  it('shows the assignment function of what a collection feeds and what it derives from', async () => {
    const user = setupUser();
    await renderMap();

    await user.click(await node('Collection colClientes'));

    const view = await panel();
    expect(view.getByRole('link', { name: 'Open collection' })).toHaveAttribute(
      'href',
      '/collections/21',
    );
    const feeds = section(view, 'Feeds');
    expect(feeds.getByRole('button', { name: /gRegistroSel/ })).toHaveTextContent(
      'Set · First · galClientes.OnSelect',
    );
    expect(feeds.getByRole('button', { name: /locMostrarDetalle/ })).toHaveTextContent(
      'UpdateContext · OnVisible',
    );
    expect(
      section(view, 'Derives from').getByRole('button', { name: /colUsuarios/ }),
    ).toBeVisible();
    expect(section(view, 'Derived by').getByRole('button', { name: /colActivos/ })).toBeVisible();
    expect(section(view, 'Accessed by').getAllByRole('button')).toHaveLength(2);
  });

  it('leads a component to the Components & navigation tab of its screen (D-102)', async () => {
    const user = setupUser();
    const { router } = await renderMap();

    await user.click(await node('Component btnGuardar'));

    const view = await panel();
    const link = view.getByRole('link', { name: 'Open screen' });
    expect(link).toHaveAttribute('href', `/screens/12?tab=${COMPONENTS_TAB}`);
    expect(section(view, 'Contained in').getByRole('button', { name: /Detalle/ })).toBeVisible();
    await user.click(link);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/screens/12');
    });
    expect(router.state.location.search).toBe(`?tab=${COMPONENTS_TAB}`);
  });

  it('still leads a component to its screen when the types filter leaves the screens out', async () => {
    const user = setupUser();
    const { router } = await renderMap({
      path: '/dependency-map?types=VARIABLE,COLLECTION,COMPONENT',
    });

    await user.click(await node('Component btnGuardar'));

    const view = await panel();
    expect(screen.queryByRole('button', { name: /^Screen / })).not.toBeInTheDocument();
    const link = view.getByRole('link', { name: 'Open screen' });
    expect(link).toHaveAttribute('href', `/screens/12?tab=${COMPONENTS_TAB}`);
    await user.click(link);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/screens/12');
    });
    expect(router.state.location.search).toBe(`?tab=${COMPONENTS_TAB}`);
  });

  it('says "No connections." for a node with none', async () => {
    const user = setupUser();
    await renderMap({
      graphs: { 1: { nodes: [screenNode(1, 'Inicio'), variableNode(5, 'gSuelta')], edges: [] } },
    });

    await user.click(await node('Variable gSuelta, Global'));

    expect((await panel()).getByText('No connections.')).toBeVisible();
  });
});

describe('side panel: moving and closing', () => {
  it('opens the panel of a connection when it is chosen, so the graph can be walked without the canvas', async () => {
    const user = setupUser();
    await renderMap();
    await user.click(await node('Screen Inicio, Approved'));

    const accesses = section(await panel(), 'Accesses');
    await user.click(accesses.getByRole('button', { name: /colClientes/ }));

    const view = await panel();
    expect(view.getByRole('heading', { name: 'colClientes', level: 2 })).toHaveFocus();
    expect(view.getByRole('link', { name: 'Open collection' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Collection colClientes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Screen Inicio, Approved' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('closes with the button and gives the focus back to the node', async () => {
    const user = setupUser();
    await renderMap();
    const inicio = await node('Screen Inicio, Approved');
    await user.click(inicio);

    await user.click((await panel()).getByRole('button', { name: 'Close panel' }));

    expect(
      screen.queryByRole('complementary', { name: 'Selected element' }),
    ).not.toBeInTheDocument();
    expect(inicio).toHaveFocus();
    expect(inicio).toHaveAttribute('aria-pressed', 'false');
  });

  it('closes with Esc from inside the panel', async () => {
    const user = setupUser();
    await renderMap();
    const inicio = await node('Screen Inicio, Approved');
    await user.click(inicio);
    await panel();

    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('complementary', { name: 'Selected element' }),
    ).not.toBeInTheDocument();
    expect(inicio).toHaveFocus();
  });

  it('opens from the keyboard: Tab to a node and Enter', async () => {
    const user = setupUser();
    await renderMap();
    const inicio = await node('Screen Inicio, Approved');

    inicio.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('complementary', { name: 'Selected element' })).toBeVisible();
    expect((await panel()).getByRole('heading', { name: 'Inicio', level: 2 })).toBeInTheDocument();
  });

  it('keeps the selection of one node at a time', async () => {
    const user = setupUser();
    await renderMap();

    await user.click(await node('Screen Inicio, Approved'));
    await user.click(await node('Screen Detalle, In review'));

    const pressed = screen
      .getAllByRole('button', { pressed: true })
      .filter((button) =>
        /^(Screen|Variable|Collection|Component) /.test(button.getAttribute('aria-label') ?? ''),
      );
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveAccessibleName('Screen Detalle, In review');
  });
});

describe('find a node (keyboard alternative to the canvas)', () => {
  it('lists the nodes by name with their type, and choosing one selects it and opens its panel', async () => {
    const user = setupUser();
    await renderMap();
    await node('Screen Inicio, Approved');

    const search = screen.getByRole('combobox', { name: 'Find a node' });
    await user.click(search);
    await user.type(search, 'gReg');
    const option = await screen.findByRole('option', { name: /gRegistroSel/ });
    expect(option).toHaveTextContent('Variable');
    expect(screen.queryByRole('option', { name: /Inicio/ })).not.toBeInTheDocument();
    await user.click(option);

    const view = await panel();
    expect(view.getByRole('heading', { name: 'gRegistroSel', level: 2 })).toHaveFocus();
    expect(view.getByText('Untraced')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Find a node' })).toHaveValue('gRegistroSel');
    expect(
      screen.getByRole('button', { name: 'Variable gRegistroSel, Global, untraced' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('works with the keyboard alone: type, arrow down, Enter', async () => {
    const user = setupUser();
    await renderMap();
    await node('Screen Inicio, Approved');

    await user.click(screen.getByRole('combobox', { name: 'Find a node' }));
    await user.keyboard('btnG');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(
      (await panel()).getByRole('heading', { name: 'btnGuardar', level: 2 }),
    ).toBeInTheDocument();
  });

  it('only offers the nodes the map shows (the filters apply)', async () => {
    const user = setupUser();
    await renderMap({ path: '/dependency-map?types=COLLECTION' });
    await node('Collection colClientes');

    await user.click(screen.getByRole('combobox', { name: 'Find a node' }));

    expect(await screen.findByRole('option', { name: /colClientes/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /Inicio/ })).not.toBeInTheDocument();
  });
});
