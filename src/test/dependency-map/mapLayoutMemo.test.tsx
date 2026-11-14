// The map is placed once per answer: selecting a node, opening or closing the panel, moving through the connections,
// searching for a node and using the zoom controls do NOT place it again (a spy on computeLayout counts the calls);
// new data (another filter, another answer) does.
import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as layoutModule from '../../modules/dependency-map/layout';
import { renderMap, type RenderMapOptions } from '../helpers/renderMap';
import { setupUser } from '../helpers/setupUser';

/** These tests are about the whole graph, which the All elements view draws; the default view is Screens. */
const renderAll = (options: RenderMapOptions = {}) =>
  renderMap({ path: '/dependency-map?view=all', ...options });

vi.mock('../../modules/dependency-map/layout', async (importOriginal) => {
  const original = await importOriginal<typeof layoutModule>();
  return { ...original, computeLayout: vi.fn(original.computeLayout) };
});

const placements = () => vi.mocked(layoutModule.computeLayout).mock.calls.length;
const node = (name: string) => screen.findByRole('button', { name });

beforeEach(() => {
  vi.mocked(layoutModule.computeLayout).mockClear();
});

describe('map placement', () => {
  it('places the map once when it loads', async () => {
    await renderAll();
    await node('Screen Inicio, Approved');

    expect(placements()).toBe(1);
  });

  it('does not place it again when a node is selected, the panel moves, searches or closes', async () => {
    const user = setupUser();
    await renderAll();
    await user.click(await node('Screen Inicio, Approved'));
    const panel = await screen.findByRole('complementary', { name: 'Selected element' });

    await user.click(within(panel).getByRole('button', { name: /colClientes/ }));
    await user.click(await node('Screen Detalle, In review'));
    // The search shows the selected node's name: clear it before typing another.
    const search = screen.getByRole('combobox', { name: 'Find a node' });
    await user.clear(search);
    await user.keyboard('gUsu{ArrowDown}{Enter}');
    await screen.findByRole('heading', { name: 'gUsuario', level: 2 });
    await user.click(screen.getByRole('button', { name: 'Close panel' }));

    expect(
      screen.queryByRole('complementary', { name: 'Selected element' }),
    ).not.toBeInTheDocument();
    expect(placements()).toBe(1);
  });

  it('does not place it again when a node is hovered or focused with the keyboard (the highlight)', async () => {
    const user = setupUser();
    await renderAll();
    const inicio = await node('Screen Inicio, Approved');

    await user.hover(inicio);
    await user.unhover(inicio);
    inicio.focus();
    inicio.blur();

    expect(placements()).toBe(1);
  });

  it('does not place it again when the zoom controls are used', async () => {
    const user = setupUser();
    await renderAll();
    await node('Screen Inicio, Approved');

    await user.click(screen.getByRole('button', { name: 'Zoom In' }));
    await user.click(screen.getByRole('button', { name: 'Zoom Out' }));
    await user.click(screen.getByRole('button', { name: 'Fit View' }));

    expect(placements()).toBe(1);
  });

  it('places it again when the data changes: another filter brings another graph', async () => {
    const user = setupUser();
    await renderAll();
    await node('Screen Inicio, Approved');

    await user.click(screen.getByRole('checkbox', { name: 'Components' }));

    await waitFor(() => {
      expect(placements()).toBe(2);
    });
    // Going back to the full graph is another answer too.
    await user.click(screen.getByRole('checkbox', { name: 'Components' }));
    await waitFor(() => {
      expect(placements()).toBe(3);
    });
  });

  it('places the client-side filter once per change, not on every render', async () => {
    const user = setupUser();
    await renderAll();
    await node('Screen Inicio, Approved');

    await user.click(screen.getByRole('button', { name: 'Show untraced only' }));
    await screen.findByText('2 elements · 1 relationship');
    await user.click(await node('Collection colClientes'));

    expect(placements()).toBe(2);
  });
});
