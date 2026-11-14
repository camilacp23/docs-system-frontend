// routeGeometry: checks of the geometry of a routed scene, shared by the tests of the layout and of the routing.
// geometryProblems(scene) -> a list of sentences, empty when the scene is right. It checks, on the boxes and the routes:
//   - no two top-level boxes overlap, and any two are at least MIN_SEPARATION apart (columns and rows have room between them);
//   - every component is inside its group, with margin, and groups have room for them;
//   - every box and every point of every line is on the 8 px grid;
//   - every line was routed (it found a free lane);
//   - every line is orthogonal: horizontal and vertical pieces only;
//   - no line crosses a box that is not its source or target, nor comes within one grid step of it, and no line enters its own
//     boxes (it starts and ends on their border);
//   - no two lines share a piece (two pieces on the same line that overlap by more than a point) and no two lines share a point
//     of a border (each has its own port);
//   - no label overlaps a box or another label;
//   - everything that is drawn is inside the bounds of the scene.
import { PITCH } from '../../modules/dependency-map/grid';
import type { Point, Rect } from '../../modules/dependency-map/edgeRouting';
import type { Scene, SceneNode } from '../../modules/dependency-map/scene';

export const MIN_SEPARATION = 32;

interface Piece {
  edge: string;
  from: Point;
  to: Point;
}

const onGrid = (value: number) => value % PITCH === 0;

function separation(a: Rect, b: Rect): number {
  const dx = Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width));
  const dy = Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height));
  return Math.max(dx, dy);
}

function overlapsInside(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** True when the piece goes through the rectangle grown by `slack` (touching the grown border does not count). */
function pieceHits(piece: Piece, rect: Rect, slack: number): boolean {
  const left = rect.x - slack;
  const right = rect.x + rect.width + slack;
  const top = rect.y - slack;
  const bottom = rect.y + rect.height + slack;
  const minX = Math.min(piece.from.x, piece.to.x);
  const maxX = Math.max(piece.from.x, piece.to.x);
  const minY = Math.min(piece.from.y, piece.to.y);
  const maxY = Math.max(piece.from.y, piece.to.y);
  return maxX > left && minX < right && maxY > top && minY < bottom;
}

function sharedLength(a: Piece, b: Piece): number {
  const aHorizontal = a.from.y === a.to.y;
  const bHorizontal = b.from.y === b.to.y;
  if (aHorizontal !== bHorizontal) return 0;
  if (aHorizontal) {
    if (a.from.y !== b.from.y) return 0;
    const low = Math.max(Math.min(a.from.x, a.to.x), Math.min(b.from.x, b.to.x));
    const high = Math.min(Math.max(a.from.x, a.to.x), Math.max(b.from.x, b.to.x));
    return Math.max(0, high - low);
  }
  if (a.from.x !== b.from.x) return 0;
  const low = Math.max(Math.min(a.from.y, a.to.y), Math.min(b.from.y, b.to.y));
  const high = Math.min(Math.max(a.from.y, a.to.y), Math.max(b.from.y, b.to.y));
  return Math.max(0, high - low);
}

export function geometryProblems(scene: Scene): string[] {
  const problems: string[] = [];
  const byKey = new Map(scene.nodes.map((node) => [node.key, node]));
  const top = scene.nodes.filter((node) => node.parentKey === null);
  const unitOf = (key: string) => byKey.get(key)?.parentKey ?? key;
  const rectOf = (node: SceneNode): Rect => ({
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  });

  // Boxes.
  for (const node of scene.nodes) {
    const values = node.parentKey === null ? [node.x, node.y] : [];
    if (![node.width, node.height, ...values].every(onGrid)) {
      problems.push(`${node.key} is not on the ${PITCH} px grid`);
    }
  }
  for (let i = 0; i < top.length; i += 1) {
    for (let j = i + 1; j < top.length; j += 1) {
      const a = top[i] as SceneNode;
      const b = top[j] as SceneNode;
      if (overlapsInside(rectOf(a), rectOf(b))) problems.push(`${a.key} overlaps ${b.key}`);
      else if (separation(rectOf(a), rectOf(b)) < MIN_SEPARATION) {
        problems.push(`${a.key} and ${b.key} are closer than ${MIN_SEPARATION}`);
      }
    }
  }
  for (const child of scene.nodes.filter((node) => node.parentKey !== null)) {
    const group = byKey.get(child.parentKey as string);
    if (!group) {
      problems.push(`${child.key} has no group`);
    } else if (
      child.x < 16 ||
      child.y < 16 ||
      child.x + child.width > group.width - 16 ||
      child.y + child.height > group.height - 16
    ) {
      problems.push(`${child.key} is not inside ${group.key} with margin`);
    }
  }

  // Lines.
  const pieces: Piece[] = [];
  const ports = new Map<string, string>();
  for (const line of scene.edges) {
    const route = line.route;
    if (!route) {
      problems.push(`${line.id} has no route`);
      continue;
    }
    if (!route.routed) problems.push(`${line.id} found no free lane`);
    const sourceBox = byKey.get(unitOf(line.source));
    const targetBox = byKey.get(unitOf(line.target));
    for (const point of route.points) {
      if (!onGrid(point.x) || !onGrid(point.y)) {
        problems.push(`${line.id} has a point off the grid (${point.x}, ${point.y})`);
        break;
      }
    }
    for (let i = 0; i + 1 < route.points.length; i += 1) {
      const from = route.points[i] as Point;
      const to = route.points[i + 1] as Point;
      if (from.x !== to.x && from.y !== to.y) {
        problems.push(`${line.id} has a piece that is not horizontal or vertical`);
      }
      const piece = { edge: line.id, from, to };
      pieces.push(piece);
      for (const box of top) {
        const own = box.key === sourceBox?.key || box.key === targetBox?.key;
        if (pieceHits(piece, rectOf(box), own ? 0 : PITCH - 1)) {
          problems.push(
            own
              ? `${line.id} goes through its own box ${box.key}`
              : `${line.id} goes through or too near ${box.key}`,
          );
        }
      }
    }
    // Ports: each end of each line is a point of a border that nobody else uses.
    const first = route.points[0];
    const last = route.points[route.points.length - 1];
    for (const point of [first, last]) {
      if (!point) continue;
      const at = `${point.x},${point.y}`;
      const holder = ports.get(at);
      if (holder !== undefined && holder !== line.id)
        problems.push(`${line.id} and ${holder} share the port ${at}`);
      ports.set(at, line.id);
    }
  }
  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      const a = pieces[i] as Piece;
      const b = pieces[j] as Piece;
      if (a.edge !== b.edge && sharedLength(a, b) > 0) {
        problems.push(`${a.edge} and ${b.edge} share a piece of line`);
      }
    }
  }

  // Labels.
  const labels = scene.edges.flatMap((line) =>
    line.route?.label ? [{ edge: line.id, rect: line.route.label }] : [],
  );
  for (const label of labels) {
    for (const box of top) {
      if (overlapsInside(label.rect, rectOf(box)))
        problems.push(`label of ${label.edge} overlaps ${box.key}`);
    }
  }
  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      if (overlapsInside((labels[i] as { rect: Rect }).rect, (labels[j] as { rect: Rect }).rect)) {
        problems.push(
          `labels of ${(labels[i] as { edge: string }).edge} and ${(labels[j] as { edge: string }).edge} overlap`,
        );
      }
    }
  }

  // Bounds.
  const bounds = scene.bounds;
  const inside = (x: number, y: number) =>
    x >= bounds.x && y >= bounds.y && x <= bounds.x + bounds.width && y <= bounds.y + bounds.height;
  for (const box of top) {
    if (!inside(box.x, box.y) || !inside(box.x + box.width, box.y + box.height)) {
      problems.push(`${box.key} is outside the bounds`);
    }
  }
  for (const line of scene.edges) {
    for (const point of line.route?.points ?? []) {
      if (!inside(point.x, point.y)) problems.push(`${line.id} leaves the bounds`);
    }
  }
  return problems;
}
