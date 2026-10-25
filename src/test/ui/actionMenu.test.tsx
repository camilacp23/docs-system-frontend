// ActionMenu placement (the "…" menu of the rows and of the detail headers). The menu is drawn in a portal on <body>
// with fixed coordinates: the scrolling container of a table (`overflow-x-auto` also clips vertically) cannot cut it,
// it opens above the button when there is no room below, it stays inside the window sideways, and its items are in
// the order they were given. Tested here on the component and on the three places that use it: the collection list,
// the variable list and the headers of the collection and variable details.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ActionMenu } from '../../components/ui';
import { menuPosition } from '../../components/ui/menuPosition';
import { renderCollections } from '../helpers/renderCollections';
import { renderVariables } from '../helpers/renderVariables';

const ITEMS = [
  { key: 'view', label: 'View', onSelect: vi.fn() },
  { key: 'edit', label: 'Edit', onSelect: vi.fn() },
  { key: 'delete', label: 'Delete', danger: true, onSelect: vi.fn() },
];

const itemNames = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent);

/** The menu must not live inside a table or any element that scrolls or clips: its parent is <body>. */
function expectOutsideClippingContainers(menu: HTMLElement) {
  expect(menu.parentElement).toBe(document.body);
  expect(menu.closest('table')).toBeNull();
  expect(menu.closest('[class*="overflow"]')).toBeNull();
  expect(menu).toHaveClass('fixed');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('menuPosition', () => {
  const viewport = { width: 1440, height: 900 };
  const menu = { width: 160, height: 120 };

  it('opens below the button, aligned to its right edge', () => {
    expect(menuPosition({ top: 100, bottom: 130, right: 1000 }, menu, viewport)).toEqual({
      top: 134,
      left: 840,
    });
  });

  it('opens above the button when there is no room below (the last row)', () => {
    expect(menuPosition({ top: 840, bottom: 870, right: 1000 }, menu, viewport)).toEqual({
      top: 716,
      left: 840,
    });
  });

  it('stays inside the window near the right and the left edges', () => {
    // Aligned to the right edge of the button (1440 - 160 = 1280), but 8 px from the edge of the window.
    expect(menuPosition({ top: 100, bottom: 130, right: 1440 }, menu, viewport).left).toBe(1272);
    expect(menuPosition({ top: 100, bottom: 130, right: 60 }, menu, viewport).left).toBe(8);
    // A menu wider than the window still starts inside it.
    expect(
      menuPosition(
        { top: 100, bottom: 130, right: 100 },
        { width: 500, height: 50 },
        {
          width: 300,
          height: 900,
        },
      ).left,
    ).toBe(8);
  });

  it('never goes above the top of the window', () => {
    expect(
      menuPosition(
        { top: 20, bottom: 50, right: 500 },
        { width: 160, height: 400 },
        {
          width: 1440,
          height: 300,
        },
      ).top,
    ).toBe(8);
  });
});

describe('ActionMenu', () => {
  function geometry(button: { top: number; bottom: number; right: number }) {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      ...button,
      left: button.right - 30,
      width: 30,
      height: button.bottom - button.top,
      x: button.right - 30,
      y: button.top,
      toJSON: () => ({}),
    });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(160);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120);
    vi.stubGlobal('innerWidth', 1440);
    vi.stubGlobal('innerHeight', 900);
  }

  async function open(user: ReturnType<typeof userEvent.setup>) {
    render(
      <div className="overflow-x-auto">
        <table>
          <tbody>
            <tr>
              <td>
                <ActionMenu label="Actions for colDemo" items={ITEMS} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: 'Actions for colDemo' }));
    return screen.getByRole('menu', { name: 'Actions for colDemo' });
  }

  it('draws the menu outside the scrolling container, with the items in order', async () => {
    geometry({ top: 100, bottom: 130, right: 1000 });
    const menu = await open(userEvent.setup());

    expectOutsideClippingContainers(menu);
    expect(itemNames(menu)).toEqual(['View', 'Edit', 'Delete']);
  });

  it('puts the menu next to its button', async () => {
    geometry({ top: 100, bottom: 130, right: 1000 });
    const menu = await open(userEvent.setup());

    expect(menu).toHaveStyle({ top: '134px', left: '840px', visibility: 'visible' });
  });

  it('opens above the button when it is the last row of the window', async () => {
    geometry({ top: 840, bottom: 870, right: 1000 });
    const menu = await open(userEvent.setup());

    expect(menu).toHaveStyle({ top: '716px' });
    expect(itemNames(menu)).toEqual(['View', 'Edit', 'Delete']);
  });

  it('stays inside the window when the button is at the right edge', async () => {
    geometry({ top: 100, bottom: 130, right: 1440 });
    const menu = await open(userEvent.setup());

    expect(menu).toHaveStyle({ left: '1272px' });
  });

  it('gives the focus to the first item, closes with Escape and returns the focus to the button', async () => {
    const user = userEvent.setup();
    geometry({ top: 100, bottom: 130, right: 1000 });
    const menu = await open(user);

    expect(within(menu).getByRole('menuitem', { name: 'View' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for colDemo' })).toHaveFocus();
  });

  it('stays open when the click is inside the menu and closes when it is outside', async () => {
    const user = userEvent.setup();
    geometry({ top: 100, bottom: 130, right: 1000 });
    const menu = await open(user);

    await user.pointer({ keys: '[MouseLeft>]', target: menu });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes when the page scrolls or the window is resized (its coordinates would be stale)', async () => {
    const user = userEvent.setup();
    geometry({ top: 100, bottom: 130, right: 1000 });
    await open(user);

    document.body.dispatchEvent(new Event('scroll'));
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Actions for colDemo' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    window.dispatchEvent(new Event('resize'));
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });
});

describe('ActionMenu in the pages', () => {
  it('collection list: every row menu is outside the table, in the order View, Edit, Delete', async () => {
    const user = userEvent.setup();
    await renderCollections();
    await screen.findByRole('link', { name: 'colUsuarios' });

    // The last row of the table, the one next to the bottom edge.
    await user.click(screen.getByRole('button', { name: 'Actions for colUsuarios' }));
    const menu = screen.getByRole('menu', { name: 'Actions for colUsuarios' });

    expectOutsideClippingContainers(menu);
    expect(itemNames(menu)).toEqual(['View', 'Edit', 'Delete']);
  });

  it('variable list: the row menu is outside the table, in the order View, Edit, Delete', async () => {
    const user = userEvent.setup();
    await renderVariables();
    await screen.findByRole('link', { name: 'locOrden' });

    await user.click(screen.getByRole('button', { name: 'Actions for locOrden' }));
    const menu = screen.getByRole('menu', { name: 'Actions for locOrden' });

    expectOutsideClippingContainers(menu);
    expect(itemNames(menu)).toEqual(['View', 'Edit', 'Delete']);
  });

  it('collection detail: the header menu is complete and outside the page container', async () => {
    const user = userEvent.setup();
    await renderCollections({ path: '/collections/11' });
    await screen.findByRole('heading', { name: 'colClientes', level: 1 });

    await user.click(screen.getByRole('button', { name: 'Actions for colClientes' }));
    const menu = screen.getByRole('menu', { name: 'Actions for colClientes' });

    expectOutsideClippingContainers(menu);
    expect(itemNames(menu)).toEqual(['Delete']);
  });

  it('variable detail: the header menu is complete and outside the page container', async () => {
    const user = userEvent.setup();
    await renderVariables({ path: '/variables/1' });
    await screen.findByRole('heading', { name: 'gUsuario', level: 1 });

    await user.click(screen.getByRole('button', { name: 'Actions for gUsuario' }));
    const menu = screen.getByRole('menu', { name: 'Actions for gUsuario' });

    expectOutsideClippingContainers(menu);
    expect(itemNames(menu)).toEqual(['Delete']);
  });

  it('a menu item of the list still works from the portal (View opens the collection)', async () => {
    const user = userEvent.setup();
    const { router } = await renderCollections();
    await screen.findByRole('link', { name: 'colUsuarios' });

    await user.click(screen.getByRole('button', { name: 'Actions for colUsuarios' }));
    await user.click(screen.getByRole('menuitem', { name: 'View' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/collections/20');
    });
  });
});
