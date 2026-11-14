// focusScene: the focus view (D-114): one element in the middle, what comes before it on the left and what comes after it on
// the right, by the flow of the data.
// buildFocusScene(data, centerKey, depth, expanded?, framedColumn?) -> Scene | null (null when the element is not in the graph).
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
// Depth 2 adds one more column on each side: what is next to the neighbors, on the side of the neighbor, never twice. At depth 2
// only the lines between NEIGHBOR columns are drawn (center - 1 - 2); the ones that jump a column, join two boxes of the same
// column or go from one side to the other are left out (`undrawn` has them, the side panel lists them and says how many).
//
// The focused element is the one that stands out: its box is a little bigger than the others (the view marks it with
// "Focused" and a thicker border), it is in the column of the middle, and the first view frames it and its neighbors of depth 1
// (`fit`), keeping it in the middle when they do not fit.
//
// A column with more than MAX_COLUMN_NODES boxes shows the first ones (in the order of the column, which is deterministic) and
// a card "+N more" that expands the rest (`expanded` holds the ids of the columns that are open, e.g. "left2"). Hidden
// boxes have no lines.
//
// A screen holds its components: the screen is a group (its components inside, see screenGroups) and the CONTAINS edges are
// not drawn. A component whose screen is in the graph lives in that group, so its edges leave from the border of the group
// and the group is the box that takes the column. A component without its screen in the graph is a box of its own.
//
// Layout: columns from the outside in; the first column on each side is ordered by type and name, the second by the
// barycenter of its neighbors in the first, ties by key. The columns are centered on the tallest one. The gap between two columns
// grows with the number of lines that cross it (each one has its own lane), and every line is routed (see edgeRouting).
import type { GraphData, GraphEdge, GraphNode, NodeType } from './graphTypes';
import { heightFor, PITCH, snap, snapUp } from './grid';
import { NODE_GAP, NODE_SIZE, type NodeSize } from './layout';
import { buildRouted, degreesOf } from './routedScene';
import { groupEdges } from './sceneEdges';
import { componentsByScreen, groupLayout, unitKeyOf } from './screenGroups';
import { makeNode, nodeKindOf, NO_BOUNDS, type Scene, type SceneNode } from './scene';

/** The base gap between two columns, before the lanes of the lines that cross it. */
export const FOCUS_COLUMN_GAP = 160;
export const MAX_FOCUS_DEPTH = 2;
/** A column shows this many boxes; the rest are behind "+N more". */
export const MAX_COLUMN_NODES = 12;
/** The card "+N more" and "Show fewer". */
export const MORE_SIZE: NodeSize = { width: 200, height: 48 };
/** The focused element is this much bigger than a plain box. */
export const CENTER_SCALE = 1.15;

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
const COLUMN_IDS = ['left2', 'left1', 'center', 'right1', 'right2'] as const;

export function moreKey(column: string): string {
  return `more:${column}`;
}

export function buildFocusScene(
  data: GraphData,
  centerKey: string,
  depth: number,
  expanded: ReadonlySet<string> = new Set(),
  framedColumn: string | null = null,
): Scene | null {
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
  for (const [unit, isLeft] of firstRing) {
    placement.set(unit, { side: isLeft ? 'left' : 'right', ring: 1 });
  }
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
  const byTypeAndName = (a: string, b: string) => {
    const keyA = `${TYPE_RANK[nodeOf(a).type]}|${nodeOf(a).name}|${a}`;
    const keyB = `${TYPE_RANK[nodeOf(b).type]}|${nodeOf(b).name}|${b}`;
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

  // A crowded column shows its first MAX_COLUMN_NODES boxes and a card for the rest.
  interface MoreEntry {
    column: string;
    hidden: number;
    expanded: boolean;
  }
  const moreOf = new Map<number, MoreEntry>();
  const shown: string[][] = columns.map((column, index) => {
    const id = COLUMN_IDS[index] ?? 'center';
    if (index === 2 || column.length <= MAX_COLUMN_NODES) return column;
    const open = expanded.has(id);
    const hidden = column.length - MAX_COLUMN_NODES;
    moreOf.set(index, { column: id, hidden, expanded: open });
    return open ? column : column.slice(0, MAX_COLUMN_NODES);
  });
  const visibleUnits = new Set(shown.flat());

  // The lines between the boxes that are shown, and how many ports each box needs. At depth 2 only the lines between
  // NEIGHBOR columns are drawn (center - 1 - 2): one that jumps a column, joins two boxes of a column or goes from one side to
  // the other would cross the whole map. They stay in the side panel, which says how many are left out.
  const columnIndexOf = new Map<string, number>();
  shown.forEach((column, index) => {
    for (const unit of column) columnIndexOf.set(unit, index);
  });
  const shownEdges = edges.filter(
    (edge) => visibleUnits.has(unitOf(edge.source)) && visibleUnits.has(unitOf(edge.target)),
  );
  const undrawnEdges =
    depth >= 2
      ? shownEdges.filter((edge) => {
          const from = unitOf(edge.source);
          const to = unitOf(edge.target);
          return (
            from !== to &&
            Math.abs((columnIndexOf.get(from) ?? 0) - (columnIndexOf.get(to) ?? 0)) !== 1
          );
        })
      : [];
  const notDrawn = new Set(undrawnEdges);
  const drawn = shownEdges.filter((edge) => !notDrawn.has(edge));
  const lines = groupEdges(
    drawn,
    'all',
    (edge) => unitOf(edge.source) === centerUnit || unitOf(edge.target) === centerUnit,
  );
  const degrees = degreesOf(lines, unitOf);

  const sizeOfUnit = (unit: string): NodeSize => {
    const children = groups.get(unit);
    const base = children ? groupLayout(children.length) : NODE_SIZE[nodeOf(unit).type];
    const sized =
      unit === centerUnit && !children
        ? {
            width: snapUp(base.width * CENTER_SCALE),
            height: snapUp(base.height * CENTER_SCALE),
          }
        : base;
    return { width: sized.width, height: heightFor(sized.height, degrees.get(unit) ?? 0) };
  };

  // Which displayed column each box is in: the lines that cross the gap after a column widen it.
  const present = shown
    .map((column, index) => ({ column, index, more: moreOf.get(index) }))
    .filter(({ column, more }) => column.length > 0 || more !== undefined);
  const positionOfColumn = new Map(present.map((entry, order) => [entry.index, order]));
  const columnOfUnit = new Map<string, number>();
  shown.forEach((column, index) => {
    for (const unit of column) columnOfUnit.set(unit, positionOfColumn.get(index) ?? 0);
  });
  const crossings = new Array<number>(present.length).fill(0);
  for (const line of lines) {
    const from = columnOfUnit.get(unitOf(line.source)) ?? 0;
    const to = columnOfUnit.get(unitOf(line.target)) ?? 0;
    if (from === to) crossings[from] = (crossings[from] ?? 0) + 1;
    else
      for (let gap = Math.min(from, to); gap < Math.max(from, to); gap += 1)
        crossings[gap] = (crossings[gap] ?? 0) + 1;
  }

  // The first view frames the focused element and its neighbors. After a column was opened or closed with "+N more" (`framedColumn`)
  // it frames that whole column instead, with its card.
  const framedIndex =
    framedColumn === null ? -1 : COLUMN_IDS.indexOf(framedColumn as (typeof COLUMN_IDS)[number]);
  const fit =
    framedColumn !== null && framedIndex >= 0
      ? {
          keys: [
            ...(shown[framedIndex] ?? []),
            ...(moreOf.has(framedIndex) ? [moreKey(framedColumn)] : []),
          ],
          anchorKey: null,
        }
      : {
          keys: [centerUnit, ...[...firstRing.keys()].filter((unit) => visibleUnits.has(unit))],
          anchorKey: centerUnit,
        };

  return buildRouted((gapScale) => {
    const nodeGap = snapUp(NODE_GAP * gapScale);
    const heights = present.map(({ column, more }) => {
      const stack = column.map((unit) => sizeOfUnit(unit).height);
      if (more) stack.push(MORE_SIZE.height);
      return stack.reduce((sum, height, index) => sum + height + (index > 0 ? nodeGap : 0), 0);
    });
    const tallest = Math.max(0, ...heights);
    const nodes: SceneNode[] = [];
    let left = 0;
    present.forEach(({ column, index, more }, order) => {
      const side: Side = index < 2 ? 'left' : index === 2 ? 'center' : 'right';
      let y = snap((tallest - (heights[order] ?? 0)) / 2);
      let width = 0;
      for (const unit of column) {
        const graphNode = nodeOf(unit);
        const size = sizeOfUnit(unit);
        const children = groups.get(unit);
        nodes.push(
          makeNode({
            key: unit,
            kind: children ? 'screenGroup' : nodeKindOf(graphNode),
            graphNode,
            x: left,
            y,
            width: size.width,
            height: size.height,
            role: placement.get(unit)?.side ?? side,
          }),
        );
        if (children) {
          const layout = groupLayout(children.length);
          children.forEach((child, childIndex) => {
            const at = layout.positions[childIndex] ?? { x: 0, y: 0 };
            nodes.push(
              makeNode({
                key: child.key,
                kind: 'component',
                graphNode: child,
                x: at.x,
                y: at.y,
                width: NODE_SIZE.COMPONENT.width,
                height: NODE_SIZE.COMPONENT.height,
                parentKey: unit,
                role: placement.get(unit)?.side ?? side,
              }),
            );
          });
        }
        y += size.height + nodeGap;
        width = Math.max(width, size.width);
      }
      if (more) {
        nodes.push(
          makeNode({
            key: moreKey(more.column),
            kind: 'more',
            graphNode: null,
            x: left,
            y,
            width: MORE_SIZE.width,
            height: MORE_SIZE.height,
            role: side === 'center' ? null : side,
            more,
          }),
        );
        width = Math.max(width, MORE_SIZE.width);
      }
      left += width + snapUp(FOCUS_COLUMN_GAP * gapScale) + (crossings[order] ?? 0) * PITCH;
    });
    return {
      nodes,
      edges: lines,
      bounds: NO_BOUNDS,
      fit,
      failures: 0,
      routingMs: 0,
      attempts: 1,
      undrawn: undrawnEdges,
    };
  });
}
