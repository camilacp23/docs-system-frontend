// layout: automatic placement of the graph, in layers from left to right. A pure function with no dependencies.
// computeLayout(data) -> { positions, durationMs }
//   positions  Map from node key to the top-left corner of its box, ready for React Flow.
//   durationMs how long the placement took (performance.now), so the cost at department scale can be measured.
// React Flow does not place nodes. The boxes have a fixed size per node type (NODE_SIZE, the same numbers the node
// components draw with) and the gaps are constants, so nothing is measured in the DOM. The same data always gives the
// same positions: every step visits nodes and edges in the order of the response, which the API fixes (D-104 d), and
// every tie is broken by the key of the node.
// Steps (all linear or near linear: about 500 nodes and 1100 edges take a few milliseconds, where the dagre library
// measured 6 s on the same graph):
//   1. Cycles (a collection derived from another that derives from it, D-74; screens that navigate to each other) are
//      broken with a depth-first walk: the edges that return to a node still on the walk are reversed FOR THE
//      CALCULATION ONLY. The edges are drawn with their real direction. Self loops (which the API never sends) and
//      repeated edges are ignored.
//   2. Layers: longest path over the graph without cycles; a node sits one layer to the right of its farthest source.
//   3. Disconnected pieces are laid out one by one and stacked from top to bottom, in the order of their first node.
//   4. Inside a layer, nodes are ordered by the barycenter of their neighbors (those on the left in the downward
//      sweep, those on the right in the upward one), four times, ties by the key of the node.
//   5. Columns are stacked with constant gaps and centered on the tallest column of their piece.
import type { GraphData, NodeType } from './graphTypes';

export interface NodeSize {
  width: number;
  height: number;
}

export const NODE_SIZE: Record<NodeType, NodeSize> = {
  SCREEN: { width: 216, height: 76 },
  VARIABLE: { width: 196, height: 66 },
  COLLECTION: { width: 196, height: 44 },
  COMPONENT: { width: 168, height: 34 },
};

/** Horizontal gap between two layers. */
export const LAYER_GAP = 96;
/** Vertical gap between two boxes of a layer. */
export const NODE_GAP = 28;
/** Vertical gap between two disconnected pieces of the graph. */
export const PIECE_GAP = 64;
/** How many times the order of the layers is improved (a downward and an upward sweep each time). */
export const ORDERING_PASSES = 4;

export interface Position {
  x: number;
  y: number;
}

export interface LayoutResult {
  positions: ReadonlyMap<string, Position>;
  durationMs: number;
}

interface Acyclic {
  successors: number[][];
  predecessors: number[][];
}

/** Step 1: the edges as a graph without cycles. Returned lists keep the order of the edges of the response. */
function breakCycles(count: number, targetsOf: readonly number[][]): Acyclic {
  const successors: number[][] = Array.from({ length: count }, () => []);
  const predecessors: number[][] = Array.from({ length: count }, () => []);
  const seen = new Set<number>();
  const add = (from: number, to: number) => {
    const key = from * count + to;
    if (seen.has(key)) return;
    seen.add(key);
    successors[from]?.push(to);
    predecessors[to]?.push(from);
  };

  // 0 = not visited, 1 = on the walk, 2 = done. Iterative, so a long chain cannot overflow the call stack.
  const state = new Uint8Array(count);
  const cursor = new Int32Array(count);
  for (let root = 0; root < count; root += 1) {
    if (state[root] !== 0) continue;
    const stack: number[] = [root];
    state[root] = 1;
    while (stack.length > 0) {
      const node = stack[stack.length - 1] ?? root;
      const targets = targetsOf[node] ?? [];
      const next = cursor[node] ?? 0;
      if (next >= targets.length) {
        state[node] = 2;
        stack.pop();
        continue;
      }
      cursor[node] = next + 1;
      const target = targets[next] ?? node;
      if (state[target] === 1) {
        add(target, node); // an edge that returns to the walk: reversed for the calculation
      } else {
        add(node, target);
        if (state[target] === 0) {
          state[target] = 1;
          stack.push(target);
        }
      }
    }
  }
  return { successors, predecessors };
}

/** Step 2: layer of each node, the longest path from a source (Kahn's order, deterministic). */
function assignLayers(count: number, graph: Acyclic): Int32Array {
  const layer = new Int32Array(count);
  const missing = new Int32Array(count);
  const queue: number[] = [];
  for (let node = 0; node < count; node += 1) {
    missing[node] = graph.predecessors[node]?.length ?? 0;
    if (missing[node] === 0) queue.push(node);
  }
  for (let head = 0; head < queue.length; head += 1) {
    const node = queue[head] ?? 0;
    for (const successor of graph.successors[node] ?? []) {
      layer[successor] = Math.max(layer[successor] ?? 0, (layer[node] ?? 0) + 1);
      missing[successor] = (missing[successor] ?? 0) - 1;
      if (missing[successor] === 0) queue.push(successor);
    }
  }
  return layer;
}

/** Step 3: the connected pieces (ignoring direction), each as its nodes in the order of the response. */
function connectedPieces(count: number, graph: Acyclic): number[][] {
  const piece = new Int32Array(count).fill(-1);
  const pieces: number[][] = [];
  for (let start = 0; start < count; start += 1) {
    if ((piece[start] ?? -1) !== -1) continue;
    const members: number[] = [];
    const stack = [start];
    piece[start] = pieces.length;
    while (stack.length > 0) {
      const node = stack.pop() ?? start;
      members.push(node);
      for (const neighbor of [
        ...(graph.successors[node] ?? []),
        ...(graph.predecessors[node] ?? []),
      ]) {
        if ((piece[neighbor] ?? -1) === -1) {
          piece[neighbor] = pieces.length;
          stack.push(neighbor);
        }
      }
    }
    pieces.push(members.sort((a, b) => a - b));
  }
  return pieces;
}

/** Step 4: orders each layer by the barycenter of the neighbors on one side, `ORDERING_PASSES` times. */
function orderLayers(layers: number[][], graph: Acyclic, keys: readonly string[]): void {
  // rank[node] = where the node sits in its layer, as a fraction, so layers of different sizes can be compared.
  const rank = new Map<number, number>();
  const refresh = () => {
    for (const members of layers) {
      members.forEach((node, index) => rank.set(node, (index + 0.5) / members.length));
    }
  };
  refresh();

  const sweep = (layerIndexes: number[], neighborsOf: readonly number[][]) => {
    for (const layerIndex of layerIndexes) {
      const members = layers[layerIndex];
      if (!members || members.length < 2) continue;
      const score = new Map<number, number>();
      for (const node of members) {
        const neighbors = neighborsOf[node] ?? [];
        let sum = 0;
        for (const neighbor of neighbors) sum += rank.get(neighbor) ?? 0;
        score.set(node, neighbors.length === 0 ? (rank.get(node) ?? 0) : sum / neighbors.length);
      }
      members.sort((a, b) => {
        const difference = (score.get(a) ?? 0) - (score.get(b) ?? 0);
        if (difference !== 0) return difference;
        const keyA = keys[a] ?? '';
        const keyB = keys[b] ?? '';
        return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
      });
      members.forEach((node, index) => rank.set(node, (index + 0.5) / members.length));
    }
  };

  const downward = layers.map((_, index) => index);
  const upward = [...downward].reverse();
  for (let pass = 0; pass < ORDERING_PASSES; pass += 1) {
    sweep(downward, graph.predecessors);
    sweep(upward, graph.successors);
  }
}

export function computeLayout(data: GraphData): LayoutResult {
  const started = performance.now();
  const count = data.nodes.length;
  const keys = data.nodes.map((node) => node.key);
  const indexOf = new Map<string, number>();
  keys.forEach((key, index) => indexOf.set(key, index));
  const sizes = data.nodes.map((node) => NODE_SIZE[node.type]);

  const targetsOf: number[][] = Array.from({ length: count }, () => []);
  for (const edge of data.edges) {
    const from = indexOf.get(edge.source);
    const to = indexOf.get(edge.target);
    // The API never sends an edge whose end is not in the response; a self loop cannot exist (D-74).
    if (from === undefined || to === undefined || from === to) continue;
    targetsOf[from]?.push(to);
  }

  const graph = breakCycles(count, targetsOf);
  const layerOf = assignLayers(count, graph);
  const positions = new Map<string, Position>();

  let top = 0;
  for (const members of connectedPieces(count, graph)) {
    const layerCount = members.reduce((most, node) => Math.max(most, (layerOf[node] ?? 0) + 1), 0);
    const layers: number[][] = Array.from({ length: layerCount }, () => []);
    for (const node of members) layers[layerOf[node] ?? 0]?.push(node);
    orderLayers(layers, graph, keys);

    const heights = layers.map((column) =>
      column.reduce(
        (sum, node, index) => sum + (sizes[node]?.height ?? 0) + (index > 0 ? NODE_GAP : 0),
        0,
      ),
    );
    const pieceHeight = Math.max(0, ...heights);
    let left = 0;
    layers.forEach((column, layerIndex) => {
      let y = top + (pieceHeight - (heights[layerIndex] ?? 0)) / 2;
      let width = 0;
      for (const node of column) {
        const size = sizes[node] ?? { width: 0, height: 0 };
        positions.set(keys[node] ?? '', { x: Math.round(left), y: Math.round(y) });
        y += size.height + NODE_GAP;
        width = Math.max(width, size.width);
      }
      left += width + LAYER_GAP;
    });
    top += pieceHeight + PIECE_GAP;
  }
  return { positions, durationMs: performance.now() - started };
}
