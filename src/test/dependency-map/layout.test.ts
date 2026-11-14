// layout: the placement is deterministic (the same data gives the same positions, also after copying the data), cycles of
// DERIVES_FROM and NAVIGATES_TO do not break it, a self loop cannot hang it, disconnected pieces and nodes without
// edges are placed, no two boxes overlap, and the time of the placement with ~500 nodes is measured and printed.
// The time has no threshold on purpose: it is a measurement (NFR-11) that goes to the report.
import { describe, expect, it } from 'vitest';

import type { GraphData, GraphNode } from '../../modules/dependency-map/graphTypes';
import {
  computeLayout,
  LAYER_GAP,
  NODE_GAP,
  NODE_SIZE,
  PIECE_GAP,
  type Position,
} from '../../modules/dependency-map/layout';
import {
  collectionNode,
  derives,
  makeLargeGraph,
  navigates,
  sampleGraph,
  screenNode,
  variableNode,
} from '../helpers/graphFixtures';

const toPlain = (positions: ReadonlyMap<string, Position>) =>
  JSON.stringify([...positions.entries()]);

/** True when two boxes share any area (touching edges do not count). */
function overlaps(a: GraphNode, b: GraphNode, positions: ReadonlyMap<string, Position>): boolean {
  const first = positions.get(a.key);
  const second = positions.get(b.key);
  if (!first || !second) return false;
  const sizeA = NODE_SIZE[a.type];
  const sizeB = NODE_SIZE[b.type];
  return (
    first.x < second.x + sizeB.width &&
    second.x < first.x + sizeA.width &&
    first.y < second.y + sizeB.height &&
    second.y < first.y + sizeA.height
  );
}

function expectNoOverlap(data: GraphData, positions: ReadonlyMap<string, Position>) {
  for (let first = 0; first < data.nodes.length; first += 1) {
    for (let second = first + 1; second < data.nodes.length; second += 1) {
      const a = data.nodes[first];
      const b = data.nodes[second];
      if (a && b && overlaps(a, b, positions)) {
        throw new Error(`${a.key} and ${b.key} overlap`);
      }
    }
  }
}

const at = (positions: ReadonlyMap<string, Position>, key: string): Position => {
  const found = positions.get(key);
  if (!found) throw new Error(`no position for ${key}`);
  return found;
};

describe('computeLayout', () => {
  it('places every node at a finite position', () => {
    const data = sampleGraph();
    const { positions } = computeLayout(data);
    expect(positions.size).toBe(data.nodes.length);
    for (const node of data.nodes) {
      const position = at(positions, node.key);
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    }
  });

  it('gives the same positions for the same data: two calls, and a copy of the data', () => {
    const data = sampleGraph();
    const copy = JSON.parse(JSON.stringify(data)) as GraphData;
    const first = toPlain(computeLayout(data).positions);
    expect(toPlain(computeLayout(data).positions)).toBe(first);
    expect(toPlain(computeLayout(copy).positions)).toBe(first);
  });

  it('gives the same positions for the large graph on every call', () => {
    const first = toPlain(computeLayout(makeLargeGraph()).positions);
    expect(toPlain(computeLayout(makeLargeGraph()).positions)).toBe(first);
  });

  it('puts a node to the right of what it comes from, and the direction of the edge is not changed by the layout', () => {
    const data: GraphData = {
      nodes: [screenNode(1, 'a'), screenNode(2, 'b'), screenNode(3, 'c')],
      edges: [navigates(1, 'screen:1', 'screen:2'), navigates(2, 'screen:2', 'screen:3')],
    };
    const { positions } = computeLayout(data);
    expect(at(positions, 'screen:1').x).toBeLessThan(at(positions, 'screen:2').x);
    expect(at(positions, 'screen:2').x).toBeLessThan(at(positions, 'screen:3').x);
    expect(at(positions, 'screen:2').x - at(positions, 'screen:1').x).toBe(
      NODE_SIZE.SCREEN.width + LAYER_GAP,
    );
    // The edges of the data are never touched.
    expect(data.edges[0]).toMatchObject({ source: 'screen:1', target: 'screen:2' });
  });

  it('places collections that derive from each other in a ring (DERIVES_FROM cycle) without overlap', () => {
    const data: GraphData = {
      nodes: [collectionNode(1, 'colA'), collectionNode(2, 'colB'), collectionNode(3, 'colC')],
      edges: [
        derives(1, 'collection:1', 'collection:2'),
        derives(2, 'collection:2', 'collection:3'),
        derives(3, 'collection:3', 'collection:1'),
      ],
    };
    const { positions } = computeLayout(data);
    expect(positions.size).toBe(3);
    expectNoOverlap(data, positions);
    expect(toPlain(computeLayout(data).positions)).toBe(toPlain(positions));
    // The walk starts at colA, so the edge that returns to it is the one reversed: colA, colB, colC from left to right.
    expect(at(positions, 'collection:1').x).toBeLessThan(at(positions, 'collection:2').x);
    expect(at(positions, 'collection:2').x).toBeLessThan(at(positions, 'collection:3').x);
  });

  it('places screens that navigate to each other (NAVIGATES_TO cycle, also two by two)', () => {
    const data: GraphData = {
      nodes: [screenNode(1, 'scrA'), screenNode(2, 'scrB'), screenNode(3, 'scrC')],
      edges: [
        navigates(1, 'screen:1', 'screen:2'),
        navigates(2, 'screen:2', 'screen:1'),
        navigates(3, 'screen:2', 'screen:3'),
        navigates(4, 'screen:3', 'screen:2'),
      ],
    };
    const { positions } = computeLayout(data);
    expect(positions.size).toBe(3);
    expectNoOverlap(data, positions);
    expect(toPlain(computeLayout(data).positions)).toBe(toPlain(positions));
  });

  it('does not hang on a self loop (the API never sends one) and ignores repeated edges', () => {
    const data: GraphData = {
      nodes: [collectionNode(1, 'colA'), collectionNode(2, 'colB')],
      edges: [
        derives(1, 'collection:1', 'collection:1'),
        derives(2, 'collection:1', 'collection:2'),
        derives(3, 'collection:1', 'collection:2'),
      ],
    };
    const { positions } = computeLayout(data);
    expect(positions.size).toBe(2);
    expect(at(positions, 'collection:1').x).toBeLessThan(at(positions, 'collection:2').x);
  });

  it('ignores an edge whose end is not in the graph', () => {
    const data: GraphData = {
      nodes: [collectionNode(1, 'colA')],
      edges: [derives(1, 'collection:1', 'collection:99')],
    };
    expect(computeLayout(data).positions.size).toBe(1);
  });

  it('lays out nodes without edges and an empty graph', () => {
    const lonely: GraphData = {
      nodes: [screenNode(1, 'a'), variableNode(1, 'v'), collectionNode(1, 'c')],
      edges: [],
    };
    const { positions } = computeLayout(lonely);
    expect(positions.size).toBe(3);
    expectNoOverlap(lonely, positions);
    expect(computeLayout({ nodes: [], edges: [] }).positions.size).toBe(0);
  });

  it('stacks disconnected pieces from top to bottom in the order of their first node', () => {
    const data: GraphData = {
      nodes: [
        screenNode(1, 'a1'),
        screenNode(2, 'a2'),
        screenNode(3, 'b1'),
        screenNode(4, 'b2'),
        variableNode(9, 'alone'),
      ],
      edges: [navigates(1, 'screen:1', 'screen:2'), navigates(2, 'screen:3', 'screen:4')],
    };
    const { positions } = computeLayout(data);
    const first = at(positions, 'screen:1');
    const second = at(positions, 'screen:3');
    const third = at(positions, 'variable:9');
    expect(first.y).toBeLessThan(second.y);
    expect(second.y).toBeLessThan(third.y);
    expect(second.y - first.y).toBe(NODE_SIZE.SCREEN.height + PIECE_GAP);
    // Every piece starts at the left edge.
    expect([first.x, second.x, third.x]).toEqual([0, 0, 0]);
    expectNoOverlap(data, positions);
  });

  it('keeps the boxes of a layer apart by the constant gap', () => {
    const data: GraphData = {
      nodes: [screenNode(1, 'root'), screenNode(2, 'left'), screenNode(3, 'right')],
      edges: [navigates(1, 'screen:1', 'screen:2'), navigates(2, 'screen:1', 'screen:3')],
    };
    const { positions } = computeLayout(data);
    const gap =
      Math.abs(at(positions, 'screen:3').y - at(positions, 'screen:2').y) - NODE_SIZE.SCREEN.height;
    expect(gap).toBe(NODE_GAP);
  });

  it('never overlaps two boxes, in the sample graph and in the large one', () => {
    for (const data of [sampleGraph(), makeLargeGraph()]) {
      expectNoOverlap(data, computeLayout(data).positions);
    }
  });

  it('measures the time with about 500 nodes and 1100 edges', () => {
    const data = makeLargeGraph(500);
    computeLayout(data); // warm-up: the first call pays for compiling the code
    const runs = [1, 2, 3, 4, 5].map(() => computeLayout(data).durationMs);
    const sorted = [...runs].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    // Printed on purpose: the number goes to the report. No threshold.
    console.log(
      `LAYOUT-TIME nodes=${data.nodes.length} edges=${data.edges.length} runs(ms)=${runs
        .map((ms) => ms.toFixed(1))
        .join(',')} median(ms)=${median.toFixed(1)}`,
    );
    expect(data.nodes).toHaveLength(500);
    expect(data.edges.length).toBeGreaterThan(1000);
    expect(median).toBeGreaterThan(0);
  });
});
