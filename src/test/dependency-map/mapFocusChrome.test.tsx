// Focus view and canvas chrome (F-14b follow-up): the "Minimap" button (off by default, remembered per visitor, never needed), the
// view that frames a whole column again when "+N more" / "Show fewer" opens or closes it (spy on setViewport), and the panel that
// lists the relationships the focus view at depth 2 does not draw.
import type * as XyFlow from '@xyflow/react';
import type { useReactFlow } from '@xyflow/react';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INSETS, READABLE_MIN_ZOOM } from '../../modules/dependency-map/canvasFit';
import { buildFocusScene } from '../../modules/dependency-map/focusScene';
import { crowdedGraph, skippingGraph } from '../helpers/graphFixtures';
import { renderMap } from '../helpers/renderMap';
import { setupUser } from '../helpers/setupUser';

type Flow = ReturnType<typeof useReactFlow>;
type Viewport = Parameters<Flow['setViewport']>[0];

// Every viewport the page sets goes through this spy, then to React Flow as usual.
const spy = vi.hoisted(() => ({ viewports: [] as Viewport[] }));
vi.mock('@xyflow/react', async (importOriginal) => {
  const real = await importOriginal<typeof XyFlow>();
  let current: Flow['setViewport'] | null = null;
  const setViewport: Flow['setViewport'] = (viewport, options) => {
    spy.viewports.push(viewport);
    return current ? current(viewport, options) : Promise.resolve(false);
  };
  return {
    ...real,
    useReactFlow: () => {
      const flow = real.useReactFlow();
      current = flow.setViewport;
      return { ...flow, setViewport };
    },
  };
});

const CANVAS = { width: 1200, height: 700 }; // the size reactFlowShims gives the canvas

beforeEach(() => {
  spy.viewports.length = 0;
  window.localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Minimap button', () => {
  it('is off by default, turns the mini map on and off, and remembers it in this browser', async () => {
    const user = setupUser();
    await renderMap();
    const button = await screen.findByRole('button', { name: 'Minimap' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('img', { name: 'Minimap' })).not.toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('img', { name: 'Minimap' })).toBeInTheDocument();
    expect(window.localStorage.getItem('dependency-map-minimap')).toBe('1');

    await user.click(button);
    expect(screen.queryByRole('img', { name: 'Minimap' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem('dependency-map-minimap')).toBe('0');
  });

  it('starts on when the visitor left it on', async () => {
    await renderMap({
      prepare: () => {
        window.localStorage.setItem('dependency-map-minimap', '1');
      },
    });
    expect(await screen.findByRole('img', { name: 'Minimap' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Minimap' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('still works when the browser does not allow storage: off at the start, and the button toggles in memory', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = setupUser();
    await renderMap();
    const button = await screen.findByRole('button', { name: 'Minimap' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(await screen.findByRole('img', { name: 'Minimap' })).toBeInTheDocument();
  });

  it('sits next to "Relationships" in the bar of the canvas', async () => {
    await renderMap();
    const relationships = await screen.findByRole('button', { name: 'Relationships' });
    expect(
      within(relationships.parentElement?.parentElement as HTMLElement).getByRole('button', {
        name: 'Minimap',
      }),
    ).toBeInTheDocument();
  });
});

describe('"+N more" frames the whole column again', () => {
  const COLUMN = 'left1';
  const framedBox = (open: boolean) => {
    const scene = buildFocusScene(
      crowdedGraph(15),
      'variable:1',
      1,
      new Set(open ? [COLUMN] : []),
      COLUMN,
    );
    const keys = new Set(scene?.fit?.keys);
    const boxes = (scene?.nodes ?? []).filter((node) => keys.has(node.key));
    return {
      left: Math.min(...boxes.map((box) => box.x)),
      top: Math.min(...boxes.map((box) => box.y)),
    };
  };

  async function framedAfter(name: string | RegExp, open: boolean) {
    const user = setupUser();
    // The card is below the first view (the column is taller than the canvas): zoom out until it is drawn.
    const transform = () =>
      (document.querySelector('.react-flow__viewport') as HTMLElement).style.transform;
    const card = async () => {
      for (let step = 0; step < 6 && screen.queryByRole('button', { name }) === null; step += 1) {
        const was = transform();
        await user.click(screen.getByRole('button', { name: 'Zoom Out' }));
        await waitFor(() => {
          expect(transform()).not.toBe(was);
        });
      }
      return screen.findByRole('button', { name });
    };
    const before = spy.viewports.length;
    await user.click(await card());
    await waitFor(() => {
      expect(spy.viewports.length).toBeGreaterThan(before);
    });
    const view = spy.viewports.at(-1) as Required<Viewport>;
    const { left, top } = framedBox(open);
    // Readable (0.7 or more) and the column starts in the free part of the canvas, none of it under the bar or the controls.
    expect(view.zoom).toBeGreaterThanOrEqual(READABLE_MIN_ZOOM);
    expect(left * view.zoom + view.x).toBeGreaterThanOrEqual(INSETS.left);
    expect(left * view.zoom + view.x).toBeLessThan(CANVAS.width - INSETS.right);
    expect(top * view.zoom + view.y).toBeGreaterThanOrEqual(INSETS.top);
    expect(top * view.zoom + view.y).toBeLessThan(CANVAS.height - INSETS.bottom);
  }

  it('opens and closes a column, and each time the view is set again over that whole column', async () => {
    await renderMap({ graphs: { 1: crowdedGraph(15) }, path: '/dependency-map?focus=variable:1' });
    await screen.findByRole('button', { name: /^Variable gShared/ });
    await waitFor(() => {
      expect(spy.viewports.length).toBeGreaterThan(0);
    });

    await framedAfter('+3 more elements', true);
    // The column is open and the card now closes it (it is below the new view too: framedAfter zooms out to it).
    await framedAfter('Show fewer', false);
  });
});

describe('the panel of the focus view at depth 2', () => {
  it('lists the relationships the map does not draw, and says how many they are', async () => {
    await renderMap({
      graphs: { 1: skippingGraph() },
      path: '/dependency-map?focus=variable:1&depth=2',
    });
    const panel = await screen.findByRole('complementary', { name: 'Selected element' });
    const section = within(panel).getByRole('region', { name: 'Not drawn' });
    expect(
      within(section).getByText(
        '3 relationships between other elements are not drawn in this view. They are listed here.',
      ),
    ).toBeInTheDocument();
    const items = within(section).getAllByRole('listitem');
    expect(items.map((item) => item.textContent).sort()).toEqual([
      'First → SecondNavigates to',
      'First → gAfterAccesses',
      'Origin → gAfterAccesses',
    ]);
    // The ones of the element in the middle are all in the usual sections of the panel.
    expect(within(panel).getAllByRole('region').length).toBeGreaterThan(1);
  });

  it('has no such section at depth 1', async () => {
    await renderMap({ graphs: { 1: skippingGraph() }, path: '/dependency-map?focus=variable:1' });
    const panel = await screen.findByRole('complementary', { name: 'Selected element' });
    expect(within(panel).queryByRole('region', { name: 'Not drawn' })).not.toBeInTheDocument();
  });
});
