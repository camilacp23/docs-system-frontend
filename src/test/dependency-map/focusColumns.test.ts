// Focus view (F-14b): a crowded column shows 12 elements and a "+N more" card, expanding it shows all of them; the first view
// reserves the room of the chrome of the canvas and keeps the focused element in the middle; the path of a routed line.
import { describe, expect, it } from 'vitest';

import { fitViewport, INSETS, overflowsCanvas } from '../../modules/dependency-map/canvasFit';
import {
  buildFocusScene,
  MAX_COLUMN_NODES,
  moreKey,
} from '../../modules/dependency-map/focusScene';
import type { GraphData } from '../../modules/dependency-map/graphTypes';
import { pathOfPoints } from '../../modules/dependency-map/routePath';
import { screenNode, variableNode, creates, makeLargeGraph } from '../helpers/graphFixtures';
import { geometryProblems } from '../helpers/routeGeometry';

const SCREENS = 15;

/** One variable created by 15 screens: its left column has 15 elements. */
function crowded(): GraphData {
  const nodes = [variableNode(1, 'gShared')];
  const edges = [];
  for (let id = 1; id <= SCREENS; id += 1) {
    nodes.push(screenNode(id, `Screen${String(id).padStart(2, '0')}`));
    edges.push(creates(id, `screen:${id}`, 'variable:1'));
  }
  return { nodes, edges };
}

describe('"+N more" in a crowded column', () => {
  it('shows the first 12 elements and a card with the rest, without lines for the hidden ones', () => {
    const scene = buildFocusScene(crowded(), 'variable:1', 1);
    expect(scene).not.toBeNull();
    const nodes = scene?.nodes ?? [];
    expect(nodes.filter((node) => node.kind === 'screen')).toHaveLength(MAX_COLUMN_NODES);
    const more = nodes.find((node) => node.kind === 'more');
    expect(more?.more).toMatchObject({ hidden: SCREENS - MAX_COLUMN_NODES, expanded: false });
    // The 12 are the first ones in a fixed order.
    expect(
      nodes
        .filter((node) => node.kind === 'screen')
        .map((node) => node.key)
        .sort(),
    ).toEqual(Array.from({ length: MAX_COLUMN_NODES }, (_, index) => `screen:${index + 1}`).sort());
    expect(scene?.edges).toHaveLength(MAX_COLUMN_NODES);
    expect(geometryProblems(scene as NonNullable<typeof scene>)).toEqual([]);
  });

  it('shows every element, and a "Show fewer" card, once the column is expanded', () => {
    const column = buildFocusScene(crowded(), 'variable:1', 1)?.nodes.find(
      (node) => node.kind === 'more',
    )?.more?.column as string;
    const scene = buildFocusScene(crowded(), 'variable:1', 1, new Set([column]));
    const nodes = scene?.nodes ?? [];
    expect(nodes.filter((node) => node.kind === 'screen')).toHaveLength(SCREENS);
    expect(nodes.find((node) => node.key === moreKey(column))?.more).toMatchObject({
      expanded: true,
    });
    expect(scene?.edges).toHaveLength(SCREENS);
    expect(geometryProblems(scene as NonNullable<typeof scene>)).toEqual([]);
  });

  it('gives the same 12 elements every time', () => {
    const keys = () =>
      buildFocusScene(crowded(), 'variable:1', 1)
        ?.nodes.map((node) => node.key)
        .join();
    expect(keys()).toBe(keys());
  });

  it('has no node over another and no line through a box, on the 500-element map', () => {
    const data = makeLargeGraph(500);
    const center = data.nodes.find((node) => node.type === 'VARIABLE')?.key as string;
    for (const depth of [1, 2]) {
      const scene = buildFocusScene(data, center, depth);
      expect(geometryProblems(scene as NonNullable<typeof scene>)).toEqual([]);
    }
  });
});

describe('the first view of the canvas', () => {
  const canvas = { width: 1440, height: 700 };

  it('puts a map that fits in the free part of the canvas, none of it under the chrome', () => {
    const view = fitViewport({
      content: { x: 0, y: 0, width: 800, height: 400 },
      anchor: null,
      canvas,
    });
    expect(view.fits).toBe(true);
    expect(view.zoom).toBe(1);
    expect(view.x).toBeGreaterThanOrEqual(INSETS.left);
    expect(view.y).toBeGreaterThanOrEqual(INSETS.top);
    expect(view.x + 800 * view.zoom).toBeLessThanOrEqual(canvas.width - INSETS.right);
  });

  it('is never below the readable zoom: a big map starts at its top left corner', () => {
    const view = fitViewport({
      content: { x: 100, y: 50, width: 6000, height: 4000 },
      anchor: null,
      canvas,
    });
    expect(view.fits).toBe(false);
    expect(view.zoom).toBeGreaterThanOrEqual(0.7);
    expect(view.x + 100 * view.zoom).toBe(view.insets.left);
    expect(view.y + 50 * view.zoom).toBe(view.insets.top);
  });

  it('centers the focused element when the map does not fit', () => {
    const anchor = { x: 3000, y: 1500, width: 200, height: 80 };
    const view = fitViewport({
      content: { x: 0, y: 0, width: 6000, height: 4000 },
      anchor,
      canvas,
    });
    const centerX = (anchor.x + anchor.width / 2) * view.zoom + view.x;
    const free = canvas.width - view.insets.left - view.insets.right;
    expect(centerX).toBeCloseTo(view.insets.left + free / 2, 5);
  });

  it('asks for the mini map only when the drawn map goes past the free part', () => {
    const bounds = { x: 0, y: 0, width: 800, height: 400 };
    expect(overflowsCanvas(bounds, { x: 100, y: 100, zoom: 1 }, canvas)).toBe(false);
    expect(overflowsCanvas(bounds, { x: 100, y: 100, zoom: 3 }, canvas)).toBe(true);
  });
});

describe('the path of a routed line', () => {
  it('goes through every point, with rounded corners', () => {
    const path = pathOfPoints([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
    ]);
    expect(path.startsWith('M 0 0') || path.startsWith('M0,0') || path.startsWith('M0 0')).toBe(
      true,
    );
    expect(path).toContain('Q');
  });

  it('is a straight line for two points', () => {
    expect(
      pathOfPoints([
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ]),
    ).not.toContain('Q');
  });
});
