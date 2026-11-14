// focusScene: the focus view (D-114): one element in the middle, what comes before it on the left and what comes after it on
// the right, by the flow of the data.
// buildFocusScene(data, centerKey, depth) -> Scene | null (null when the element is not in the graph).
//
// Which side a neighbor goes on is decided by which end of the edge is UPSTREAM (the one the data or the control comes from):
//   CREATES        the screen that creates the variable is upstream           (source)
//   FEEDS          the collection that feeds the variable is upstream         (source)
//   NAVIGATES_TO   the screen you navigate from is upstream                   (source)
//   CONTAINS       the screen that contains the component is upstream         (source)
//   DERIVES_FROM   the collection it derives from is upstream                 (target)
//   USES           the variable or collection a component uses is upstream    (target)
//   ACCESSES       READ and READ_WRITE: the element that is read is upstream, it enters the screen        (target)
//                  WRITE: the screen is upstream, the element it writes is downstream, it leaves it        (source)
// A neighbor upstream of the center goes to the LEFT; one downstream goes to the RIGHT. A neighbor appears ONCE: if it has
// relations in both directions with the center it goes to the left, and its edges keep their real direction.
// Depth 2 adds one more column on each side: what is next to the neighbors, on the side of the neighbor, never twice.
//
// A screen holds its components: the screen is a group (its components inside, see screenGroups) and the CONTAINS edges are
// not drawn. A component whose screen is in the graph lives in that group, so its edges leave from inside the group and
// the group is the box that takes the column. A component without its screen in the graph is a box of its own.
//
// Layout: columns from the outside in; the first column on each side is ordered by type and name, the second by the
// barycenter of its neighbors in the first, ties by key. The columns are centered on the tallest one. Deterministic.
import type { GraphData, GraphEdge, GraphNode, NodeType } from './graphTypes';
import { NODE_GAP, NODE_SIZE, type NodeSize } from './layout';
import { groupEdges } from './sceneEdges';
import { componentsByScreen, groupLayout, unitKeyOf } from './screenGroups';
import { nodeKindOf, type Scene, type SceneNode } from './scene';

export const FOCUS_COLUMN_GAP = 140;
export const MAX_FOCUS_DEPTH = 2;

type Side = 'left' | 'right' | 'center';

interface Neighbor {
  unit: string;
  /** True when the neighbor is upstream of the unit the list belongs to. */
  isLeft: boolean;
}

/** The end of the edge the data or the control comes from. */
export function upstreamKeyOf(edge: GraphEdge): string {
  switch (edge.kind) {
    case 'DERIVES_FROM':
    case 'USES':
      return edge.target;
    case 'ACCESSES':
      return edge.accessMode === 'WRITE' ? edge.source : edge.target;
    default:
      return edge.source;
  }
}

const TYPE_RANK: Record<NodeType, number> = { SCREEN: 0, VARIABLE: 1, COLLECTION: 2, COMPONENT: 3 };

export function buildFocusScene(data: GraphData, centerKey: string, depth: number): Scene | null {
  const nodesByKey = new Map(data.nodes.map((node) => [node.key, node]));
  if (!nodesByKey.has(centerKey)) return null;
  const groups = componentsByScreen(data);
  const unitOf = (key: string) => {
    const node = nodesByKey.get(key);
    return node ? unitKeyOf(node, groups) : key;
  };
  const edges = data.edges.filter(
    (edge) =>
      edge.kind !== 'CONTAINS' && nodesByKey.has(edge.source) && nodesByKey.has(edge.target),
  );

  // Neighbors of every box (a screen and its components are one box), in the order of the edges.
  const neighbors = new Map<string, Neighbor[]>();
  const link = (from: string, to: string, isLeft: boolean) => {
    const list = neighbors.get(from);
    if (list) list.push({ unit: to, isLeft });
    else neighbors.set(from, [{ unit: to, isLeft }]);
  };
  for (const edge of edges) {
    const source = unitOf(edge.source);
    const target = unitOf(edge.target);
    if (source === target) continue;
    const upstream = unitOf(upstreamKeyOf(edge));
    link(source, target, upstream === target);
    link(target, source, upstream === source);
  }

  // Which side and column each box takes.
  const centerUnit = unitOf(centerKey);
  const placement = new Map<string, { side: Side; ring: number }>([
    [centerUnit, { side: 'center', ring: 0 }],
  ]);
  const firstRing = new Map<string, boolean>();
  for (const { unit, isLeft } of neighbors.get(centerUnit) ?? []) {
    firstRing.set(unit, (firstRing.get(unit) ?? false) || isLeft);
  }
  for (const [unit, isLeft] of firstRing)
    placement.set(unit, { side: isLeft ? 'left' : 'right', ring: 1 });
  if (depth >= 2) {
    for (const [unit] of firstRing) {
      const side = placement.get(unit)?.side ?? 'right';
      for (const next of neighbors.get(unit) ?? []) {
        if (!placement.has(next.unit)) placement.set(next.unit, { side, ring: 2 });
      }
    }
  }

  // Columns, from the outside in: left 2, left 1, center, right 1, right 2.
  const columnOf = (side: Side, ring: number) =>
    side === 'left' ? 2 - ring : side === 'center' ? 2 : 2 + ring;
  const columns: string[][] = [[], [], [], [], []];
  for (const [unit, { side, ring }] of placement) columns[columnOf(side, ring)]?.push(unit);

  const nodeOf = (unit: string) => nodesByKey.get(unit) as GraphNode;
  const nameOf = (unit: string) => nodeOf(unit).name;
  const byTypeAndName = (a: string, b: string) => {
    const keyA = `${TYPE_RANK[nodeOf(a).type]}|${nameOf(a)}|${a}`;
    const keyB = `${TYPE_RANK[nodeOf(b).type]}|${nameOf(b)}|${b}`;
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  };
  columns[1]?.sort(byTypeAndName);
  columns[3]?.sort(byTypeAndName);
  const rank = new Map<string, number>();
  const refresh = (column: string[] | undefined) =>
    column?.forEach((unit, index) => rank.set(unit, (index + 0.5) / column.length));
  refresh(columns[1]);
  refresh(columns[3]);
  for (const [outer, inner] of [
    [0, 1],
    [4, 3],
  ] as const) {
    const column = columns[outer];
    if (!column || column.length < 2) continue;
    const innerUnits = new Set(columns[inner]);
    const score = (unit: string) => {
      const near = (neighbors.get(unit) ?? []).filter((entry) => innerUnits.has(entry.unit));
      return near.length === 0
        ? 0.5
        : near.reduce((sum, entry) => sum + (rank.get(entry.unit) ?? 0.5), 0) / near.length;
    };
    column.sort((a, b) => score(a) - score(b) || (a < b ? -1 : a > b ? 1 : 0));
  }

  // Sizes and positions.
  const sizeOfUnit = (unit: string): NodeSize => {
    const children = groups.get(unit);
    return children ? groupLayout(children.length) : NODE_SIZE[nodeOf(unit).type];
  };
  const heights = columns.map((column) =>
    column.reduce(
      (sum, unit, index) => sum + sizeOfUnit(unit).height + (index > 0 ? NODE_GAP : 0),
      0,
    ),
  );
  const tallest = Math.max(0, ...heights);
  const nodes: SceneNode[] = [];
  let left = 0;
  columns.forEach((column, columnIndex) => {
    if (column.length === 0) return;
    let y = (tallest - (heights[columnIndex] ?? 0)) / 2;
    let width = 0;
    for (const unit of column) {
      const graphNode = nodeOf(unit);
      const size = sizeOfUnit(unit);
      const children = groups.get(unit);
      const place = placement.get(unit);
      const role = place?.side ?? null;
      nodes.push({
        key: unit,
        kind: children ? 'screenGroup' : nodeKindOf(graphNode),
        graphNode,
        x: Math.round(left),
        y: Math.round(y),
        width: size.width,
        height: size.height,
        parentKey: null,
        counters: null,
        role,
      });
      if (children) {
        const layout = groupLayout(children.length);
        children.forEach((child, index) => {
          const at = layout.positions[index] ?? { x: 0, y: 0 };
          nodes.push({
            key: child.key,
            kind: 'component',
            graphNode: child,
            x: at.x,
            y: at.y,
            width: NODE_SIZE.COMPONENT.width,
            height: NODE_SIZE.COMPONENT.height,
            parentKey: unit,
            counters: null,
            role,
          });
        });
      }
      y += size.height + NODE_GAP;
      width = Math.max(width, size.width);
    }
    left += width + FOCUS_COLUMN_GAP;
  });

  const placed = new Set(nodes.map((node) => node.key));
  const drawn = edges.filter((edge) => placed.has(edge.source) && placed.has(edge.target));
  return { nodes, edges: groupEdges(drawn, 'all') };
}
