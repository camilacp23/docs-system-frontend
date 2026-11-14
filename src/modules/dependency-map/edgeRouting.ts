// edgeRouting: where every line of the map runs. A pure function of the layout: no DOM, no React Flow.
// routeEdges(input) -> { routes, failures, bounds, durationMs }
//
// Input: the boxes (top-level, absolute), which component lives in which box and at what height (a component of a screen
// group has no port of its own: its lines leave through the border of the group, level with the component), and the edges.
//
// What it guarantees (and the tests of the geometry check on the data of 13 and ~500 elements):
//   - a line never crosses a box that is not its source or its target, nor passes within one grid step of it, and never
//     enters a screen group: the boxes are obstacles;
//   - two lines never share a piece of line: each one has its own lane. They run on the 8 px grid and a grid cell is used by
//     at most one line in each direction (two lines may cross at right angles, never touch, join or run side by side on the
//     same lane);
//   - each line leaves and enters through its own PORT: the ports of a side are spread along the side (see grid), ordered by
//     where the other end is so lines cross as little as possible; two lines never share a point of a border;
//   - a line that goes left to right leaves the right side of its source and enters the left side of its target, and one that
//     goes right to left, the other way round; boxes in the same column connect through their right sides;
//   - labels are placed on a horizontal piece of their line, never over a box or another label; when there is no room the
//     label is not placed (its text stays available in the tooltip and in the side panel).
// How: every line is searched with A* on a grid with a cost for length, for each turn and for each crossing, shortest lines
// first. If some line cannot find a free lane the caller gets `failures` > 0 and lays the map out again with more room (see
// routedScene). The cost is a few milliseconds for the 40 screens of the large sample and a few hundred for ~100 boxes.
import { PITCH, PORT_MARGIN, portCount } from './grid';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RouteBox extends Rect {
  key: string;
}

export interface RouteEndpoint {
  /** The key of the node the line starts or ends at (it may be a component inside a group). */
  key: string;
}

export interface RouteEdgeInput {
  id: string;
  source: string;
  target: string;
  /** The text of the label, if the line has one. */
  label: string | null;
  /** Lines whose label matters most are placed first (those touching the focused element). */
  labelFirst: boolean;
}

export interface RouteInput {
  boxes: readonly RouteBox[];
  /** Components inside a group: the box they live in and the height (absolute) of their center. */
  children: ReadonlyMap<string, { box: string; centerY: number }>;
  edges: readonly RouteEdgeInput[];
}

export interface RouteLabel extends Rect {
  /** Text of the label (the width is an estimate from its length). */
  text: string;
}

export interface Route {
  /** The polyline, from a point on the border of the source to a point on the border of the target. */
  points: Point[];
  label: RouteLabel | null;
  /** False when no free lane was found and the line is a straight fallback. */
  routed: boolean;
}

export interface RoutingResult {
  routes: Map<string, Route>;
  failures: number;
  bounds: Rect;
  durationMs: number;
}

export const LABEL_HEIGHT = 20;
const LABEL_CHAR_WIDTH = 7;
const LABEL_PADDING = 16;
const MARGIN_CELLS = 24;
/** Every port leaves straight for this many cells before the line may turn, so neighbors cannot wall each other in. */
const ESCAPE_CELLS = 2;
/**
 * After the escape come RESERVED_CELLS more that are the line's own for going straight or turning, but other lines may cross
 * them at a right angle: a line can always get out of its port, however the lines around it turn.
 */
const RESERVED_CELLS = 4;
/** How many times the lines are routed again, the ones without a lane first. */
const MAX_PASSES = 4;
const TURN_COST = 6;
const CROSS_COST = 8;
/** A grid bigger than this is not searched (the lines are left as straight fallbacks and the caller is told). */
const MAX_CELLS = 700_000;

const HORIZONTAL = 1;
const VERTICAL = 2;
const CORNER = 4;
const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];

type Side = 'left' | 'right';

interface Port {
  /** The point on the border of the box. */
  point: Point;
  /** The cells straight out of the border that belong to the line, the last one is where the search starts or ends. */
  escape: Point[];
  /** The last of them. */
  stub: Point;
  side: Side;
}

interface Pending {
  index: number;
  edge: RouteEdgeInput;
  sourceBox: RouteBox;
  targetBox: RouteBox;
  sourceSide: Side;
  targetSide: Side;
  sourcePreferred: number | null;
  targetPreferred: number | null;
  sourcePort: Port | null;
  targetPort: Port | null;
}

export function estimateLabelWidth(text: string): number {
  return text.length * LABEL_CHAR_WIDTH + LABEL_PADDING;
}

function intersects(a: Rect, b: Rect, slack = 0): boolean {
  return (
    a.x < b.x + b.width + slack &&
    b.x < a.x + a.width + slack &&
    a.y < b.y + b.height + slack &&
    b.y < a.y + a.height + slack
  );
}

/** Spreads `count` endpoints, already sorted, over `slots` ports: evenly, or each as near as it can to where it wants to be. */
function assignSlots(wanted: readonly number[] | null, count: number, slots: number): number[] {
  if (slots <= 0) return Array.from({ length: count }, () => 0);
  if (wanted === null) {
    return Array.from({ length: count }, (_, i) =>
      Math.min(slots - 1, Math.floor(((i + 0.5) * slots) / count)),
    );
  }
  const chosen: number[] = [];
  let previous = -1;
  for (const target of wanted) {
    const slot = Math.max(previous + 1, Math.min(slots - 1, target));
    chosen.push(slot);
    previous = slot;
  }
  // If the last ones ran past the end, push the whole run back.
  for (let i = chosen.length - 1; i >= 0; i -= 1) {
    const limit = i === chosen.length - 1 ? slots - 1 : (chosen[i + 1] ?? slots) - 1;
    if ((chosen[i] ?? 0) > limit) chosen[i] = limit;
  }
  return chosen;
}

class MinHeap {
  private keys: number[] = [];
  private values: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, value: number): void {
    let at = this.keys.length;
    this.keys.push(key);
    this.values.push(value);
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if ((this.keys[parent] ?? 0) <= key) break;
      this.keys[at] = this.keys[parent] ?? 0;
      this.values[at] = this.values[parent] ?? 0;
      at = parent;
    }
    this.keys[at] = key;
    this.values[at] = value;
  }

  pop(): number {
    const top = this.values[0] ?? 0;
    const lastKey = this.keys.pop() ?? 0;
    const lastValue = this.values.pop() ?? 0;
    const size = this.keys.length;
    if (size > 0) {
      let at = 0;
      for (;;) {
        let child = at * 2 + 1;
        if (child >= size) break;
        if (child + 1 < size && (this.keys[child + 1] ?? 0) < (this.keys[child] ?? 0)) child += 1;
        if ((this.keys[child] ?? 0) >= lastKey) break;
        this.keys[at] = this.keys[child] ?? 0;
        this.values[at] = this.values[child] ?? 0;
        at = child;
      }
      this.keys[at] = lastKey;
      this.values[at] = lastValue;
    }
    return top;
  }
}

export function routeEdges(input: RouteInput): RoutingResult {
  const started = performance.now();
  const routes = new Map<string, Route>();
  const boxByKey = new Map(input.boxes.map((box) => [box.key, box]));
  if (input.boxes.length === 0) {
    return { routes, failures: 0, bounds: { x: 0, y: 0, width: 0, height: 0 }, durationMs: 0 };
  }

  // ---- The ends of every line.
  const unitOf = (key: string) => input.children.get(key)?.box ?? key;
  const preferredOf = (key: string) => input.children.get(key)?.centerY ?? null;
  const pending: Pending[] = [];
  input.edges.forEach((edge, index) => {
    const sourceBox = boxByKey.get(unitOf(edge.source));
    const targetBox = boxByKey.get(unitOf(edge.target));
    if (!sourceBox || !targetBox || sourceBox.key === targetBox.key) return;
    let sourceSide: Side = 'right';
    let targetSide: Side = 'left';
    if (targetBox.x >= sourceBox.x + sourceBox.width) {
      // left to right
    } else if (targetBox.x + targetBox.width <= sourceBox.x) {
      sourceSide = 'left';
      targetSide = 'right';
    } else {
      targetSide = 'right'; // the same column: both through their right sides
    }
    pending.push({
      index,
      edge,
      sourceBox,
      targetBox,
      sourceSide,
      targetSide,
      sourcePreferred: preferredOf(edge.source),
      targetPreferred: preferredOf(edge.target),
      sourcePort: null,
      targetPort: null,
    });
  });

  // ---- Ports: the ends of a side of a box, sorted by where the other end is, spread along the side.
  interface End {
    entry: Pending;
    end: 'source' | 'target';
    sortY: number;
    wantedY: number | null;
  }
  const bySide = new Map<string, End[]>();
  const addEnd = (box: RouteBox, side: Side, end: End) => {
    const key = `${box.key}|${side}`;
    const list = bySide.get(key);
    if (list) list.push(end);
    else bySide.set(key, [end]);
  };
  const centerY = (box: RouteBox) => box.y + box.height / 2;
  for (const entry of pending) {
    const sourceOther = entry.targetPreferred ?? centerY(entry.targetBox);
    const targetOther = entry.sourcePreferred ?? centerY(entry.sourceBox);
    addEnd(entry.sourceBox, entry.sourceSide, {
      entry,
      end: 'source',
      sortY: sourceOther,
      wantedY: entry.sourcePreferred,
    });
    addEnd(entry.targetBox, entry.targetSide, {
      entry,
      end: 'target',
      sortY: targetOther,
      wantedY: entry.targetPreferred,
    });
  }
  for (const [key, ends] of bySide) {
    const [boxKey, sideName] = key.split('|') as [string, Side];
    const box = boxByKey.get(boxKey) as RouteBox;
    // Ends at a component of a group keep the height of the component; the others are spread over the whole side.
    const aligned = ends.some((end) => end.wantedY !== null);
    ends.sort(
      (a, b) => (a.wantedY ?? a.sortY) - (b.wantedY ?? b.sortY) || a.entry.index - b.entry.index,
    );
    const slots = portCount(box.height);
    const wanted = aligned
      ? ends.map((end) => Math.round(((end.wantedY ?? end.sortY) - box.y - PORT_MARGIN) / PITCH))
      : null;
    const chosen = assignSlots(wanted, ends.length, slots);
    ends.forEach((end, i) => {
      const y = box.y + PORT_MARGIN + (chosen[i] ?? 0) * PITCH;
      const x = sideName === 'right' ? box.x + box.width : box.x;
      const outward = sideName === 'right' ? 1 : -1;
      const escape = Array.from({ length: ESCAPE_CELLS }, (_, step) => ({
        x: x + outward * PITCH * (step + 1),
        y,
      }));
      const port: Port = {
        point: { x, y },
        escape,
        stub: escape[ESCAPE_CELLS - 1] as Point,
        side: sideName,
      };
      if (end.end === 'source') end.entry.sourcePort = port;
      else end.entry.targetPort = port;
    });
  }

  // ---- The grid.
  const margin = MARGIN_CELLS * PITCH;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of input.boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  const originX = Math.floor((minX - margin) / PITCH) * PITCH;
  const originY = Math.floor((minY - margin) / PITCH) * PITCH;
  const width = Math.ceil((maxX + margin - originX) / PITCH) + 1;
  const height = Math.ceil((maxY + margin - originY) / PITCH) + 1;
  const cellOf = (point: Point) => ({
    cx: Math.round((point.x - originX) / PITCH),
    cy: Math.round((point.y - originY) / PITCH),
  });

  let failures = 0;
  const tooBig = width * height > MAX_CELLS;
  const blocked = new Uint8Array(tooBig ? 1 : width * height);
  const usage = new Uint8Array(tooBig ? 1 : width * height);
  const owner = new Int32Array(tooBig ? 1 : width * height).fill(-1);
  /** 0 free, 1 strict (the first cells of a port: nobody else), 2 reserved (the line's own, others may cross it). */
  const kind = new Uint8Array(tooBig ? 1 : width * height);

  if (!tooBig) {
    for (const box of input.boxes) {
      const from = cellOf({ x: box.x, y: box.y });
      const to = cellOf({ x: box.x + box.width, y: box.y + box.height });
      for (let cy = from.cy; cy <= to.cy; cy += 1) {
        for (let cx = from.cx; cx <= to.cx; cx += 1) blocked[cy * width + cx] = 1;
      }
    }
    // The cells in front of every port belong to its line. The first ones nobody else may use; the next ones are reserved
    // for it (it may go straight or turn there) but other lines may cross them at a right angle.
    for (const entry of pending) {
      for (const port of [entry.sourcePort, entry.targetPort]) {
        if (!port) continue;
        const outward = port.side === 'right' ? 1 : -1;
        for (let step = 1; step <= ESCAPE_CELLS + RESERVED_CELLS; step += 1) {
          const { cx, cy } = cellOf({ x: port.point.x + outward * PITCH * step, y: port.point.y });
          if (cx < 0 || cx >= width) continue;
          const cell = cy * width + cx;
          if (blocked[cell] === 1 || owner[cell] !== -1) continue;
          owner[cell] = entry.index;
          kind[cell] = step <= ESCAPE_CELLS ? 1 : 2;
        }
      }
    }
  }

  // ---- Shortest lines first.
  const order = [...pending].sort((a, b) => {
    const length = (entry: Pending) =>
      Math.abs((entry.sourcePort?.stub.x ?? 0) - (entry.targetPort?.stub.x ?? 0)) +
      Math.abs((entry.sourcePort?.stub.y ?? 0) - (entry.targetPort?.stub.y ?? 0));
    return length(a) - length(b) || a.index - b.index;
  });

  const stateCount = tooBig ? 1 : width * height * 4;
  const cost = new Float32Array(stateCount);
  const stamp = new Int32Array(stateCount);
  const previous = new Int32Array(stateCount);
  let round = 0;

  /** Cost of moving into `cell` going in `direction` for the line `index`, or -1 when it cannot. */
  const enter = (cell: number, direction: number, index: number): number => {
    if (blocked[cell] === 1) return -1;
    const holder = owner[cell] ?? -1;
    const flags = usage[cell] ?? 0;
    const horizontal = direction < 2;
    if (holder !== -1 && holder !== index) {
      // Someone else's port: the first cells are theirs alone, the reserved ones may be crossed at a right angle.
      if (kind[cell] !== 2 || horizontal) return -1;
      if ((flags & (CORNER | VERTICAL)) !== 0) return -1;
      return 1 + CROSS_COST;
    }
    if (flags === 0) return 1;
    if ((flags & CORNER) !== 0) return -1;
    const own = horizontal ? HORIZONTAL : VERTICAL;
    if ((flags & own) !== 0) return -1;
    return 1 + CROSS_COST; // a right-angle crossing
  };

  const search = (
    entry: Pending,
    window: number,
  ): { cells: number[]; directions: number[] } | null => {
    const sourcePort = entry.sourcePort as Port;
    const targetPort = entry.targetPort as Port;
    const start = cellOf(sourcePort.stub);
    const goal = cellOf(targetPort.stub);
    const low = {
      x: Math.max(0, Math.min(start.cx, goal.cx) - window),
      y: Math.max(0, Math.min(start.cy, goal.cy) - window),
    };
    const high = {
      x: Math.min(width - 1, Math.max(start.cx, goal.cx) + window),
      y: Math.min(height - 1, Math.max(start.cy, goal.cy) + window),
    };
    round += 1;
    const heap = new MinHeap();
    const startDirection = sourcePort.side === 'right' ? 0 : 1;
    const goalCell = goal.cy * width + goal.cx;
    const startState = (start.cy * width + start.cx) * 4 + startDirection;
    cost[startState] = 0;
    stamp[startState] = round;
    previous[startState] = -1;
    const heuristic = (cx: number, cy: number) => Math.abs(cx - goal.cx) + Math.abs(cy - goal.cy);
    heap.push(heuristic(start.cx, start.cy), startState);

    while (heap.size > 0) {
      const state = heap.pop();
      const cell = state >> 2;
      const direction = state & 3;
      if (cell === goalCell) {
        const cells: number[] = [];
        const directions: number[] = [];
        for (let at = state; at !== -1; at = previous[at] ?? -1) {
          cells.push(at >> 2);
          directions.push(at & 3);
        }
        cells.reverse();
        directions.reverse();
        return { cells, directions };
      }
      const base = cost[state] ?? 0;
      const cx = cell % width;
      const cy = (cell - cx) / width;
      const consider = (nextState: number, nextCost: number, nx: number, ny: number) => {
        if (stamp[nextState] === round && (cost[nextState] ?? Infinity) <= nextCost) return;
        stamp[nextState] = round;
        cost[nextState] = nextCost;
        previous[nextState] = state;
        heap.push(nextCost + heuristic(nx, ny), nextState);
      };
      // Straight on.
      const nx = cx + (DX[direction] ?? 0);
      const ny = cy + (DY[direction] ?? 0);
      if (nx >= low.x && nx <= high.x && ny >= low.y && ny <= high.y) {
        const next = ny * width + nx;
        const step = enter(next, direction, entry.index);
        if (step !== -1) consider(next * 4 + direction, base + step, nx, ny);
      }
      // Turn here: only in a cell nobody else uses (a corner is not a crossing).
      if ((usage[cell] ?? 0) === 0 && ((owner[cell] ?? -1) === -1 || owner[cell] === entry.index)) {
        const turns = direction < 2 ? [2, 3] : [0, 1];
        for (const turn of turns) consider(cell * 4 + turn, base + TURN_COST, cx, cy);
      }
    }
    return null;
  };

  /** Records the cells a line uses: a straight piece takes its direction, a turn or an end takes the cell whole. */
  const mark = (cells: number[], directions: number[]) => {
    cells.forEach((cell, i) => {
      const incoming = i === 0 ? null : (directions[i] ?? 0);
      const outgoing = i === cells.length - 1 ? null : (directions[i + 1] ?? 0);
      let flag = CORNER;
      if (incoming !== null && outgoing !== null && incoming === outgoing) {
        flag = incoming < 2 ? HORIZONTAL : VERTICAL;
      }
      usage[cell] = (usage[cell] ?? 0) | flag;
    });
  };

  const toPoint = (cell: number): Point => {
    const cx = cell % width;
    const cy = (cell - cx) / width;
    return { x: originX + cx * PITCH, y: originY + cy * PITCH };
  };

  const simplify = (points: Point[]): Point[] => {
    const out: Point[] = [];
    for (const point of points) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      if (b && b.x === point.x && b.y === point.y) continue;
      if (a && b && ((a.x === b.x && b.x === point.x) || (a.y === b.y && b.y === point.y))) {
        out[out.length - 1] = point;
      } else out.push(point);
    }
    return out;
  };

  // The state of the grid with only the ports reserved: every pass starts from it.
  const baseUsage = usage.slice();

  /** Routes every line in the given order on a clean grid. */
  const runPass = (sequence: readonly Pending[]) => {
    usage.set(baseUsage);
    const passRoutes = new Map<string, Route>();
    const failed: Pending[] = [];
    for (const entry of sequence) {
      const sourcePort = entry.sourcePort as Port;
      const targetPort = entry.targetPort as Port;
      let found: { cells: number[]; directions: number[] } | null = null;
      if (!tooBig) {
        for (const window of [24, 80, Math.max(width, height)]) {
          found = search(entry, window);
          if (found !== null) break;
        }
      }
      if (found === null) {
        failed.push(entry);
        passRoutes.set(entry.edge.id, {
          points: simplify([sourcePort.point, sourcePort.stub, targetPort.stub, targetPort.point]),
          label: null,
          routed: false,
        });
        continue;
      }
      mark(found.cells, found.directions);
      passRoutes.set(entry.edge.id, {
        points: simplify([sourcePort.point, ...found.cells.map(toPoint), targetPort.point]),
        label: null,
        routed: true,
      });
    }
    return { passRoutes, failed };
  };

  // A line that finds no lane is routed FIRST in the next pass, while the grid is still free (a few passes at most).
  let best = runPass(order);
  for (let pass = 1; pass < MAX_PASSES && best.failed.length > 0 && !tooBig; pass += 1) {
    const failedFirst = new Set(best.failed.map((entry) => entry.index));
    const next = runPass([
      ...best.failed,
      ...order.filter((entry) => !failedFirst.has(entry.index)),
    ]);
    if (next.failed.length < best.failed.length) best = next;
    else if (next.failed.length === best.failed.length) break;
  }
  failures = best.failed.length;
  for (const [id, route] of best.passRoutes) routes.set(id, route);

  // ---- Labels: on a horizontal piece of the line, where nothing else is.
  const placed: Rect[] = [];
  const labeled = [...pending]
    .filter((entry) => entry.edge.label !== null && routes.get(entry.edge.id)?.routed === true)
    .sort((a, b) => Number(b.edge.labelFirst) - Number(a.edge.labelFirst) || a.index - b.index);
  for (const entry of labeled) {
    const route = routes.get(entry.edge.id);
    const text = entry.edge.label;
    if (!route || text === null) continue;
    const labelWidth = estimateLabelWidth(text);
    const pieces: Array<{ from: Point; to: Point; length: number }> = [];
    for (let i = 0; i + 1 < route.points.length; i += 1) {
      const from = route.points[i] as Point;
      const to = route.points[i + 1] as Point;
      if (from.y === to.y && Math.abs(to.x - from.x) >= labelWidth + 2 * PITCH) {
        pieces.push({ from, to, length: Math.abs(to.x - from.x) });
      }
    }
    pieces.sort((a, b) => b.length - a.length);
    for (const piece of pieces) {
      const rect: Rect = {
        x: Math.round((piece.from.x + piece.to.x) / 2 - labelWidth / 2),
        y: piece.from.y - LABEL_HEIGHT / 2,
        width: labelWidth,
        height: LABEL_HEIGHT,
      };
      const clear =
        !input.boxes.some((box) => intersects(rect, box, 2)) &&
        !placed.some((other) => intersects(rect, other, 2));
      if (clear) {
        placed.push(rect);
        route.label = { ...rect, text };
        break;
      }
    }
  }

  // ---- Bounds of everything that is drawn.
  let left = minX;
  let top = minY;
  let right = maxX;
  let bottom = maxY;
  for (const route of routes.values()) {
    for (const point of route.points) {
      left = Math.min(left, point.x);
      top = Math.min(top, point.y);
      right = Math.max(right, point.x);
      bottom = Math.max(bottom, point.y);
    }
    if (route.label) {
      left = Math.min(left, route.label.x);
      right = Math.max(right, route.label.x + route.label.width);
    }
  }
  return {
    routes,
    failures,
    bounds: { x: left, y: top, width: right - left, height: bottom - top },
    durationMs: performance.now() - started,
  };
}
