// routePath: the SVG path of a route. pathOfPoints(points) -> "M x y L ..." with the corners rounded (a quadratic curve through
// each corner, at most half of each piece), so a line with right angles does not look like a circuit board.
import type { Point } from './edgeRouting';

const CORNER_RADIUS = 8;

/** M x y L ... with the corners rounded (a quadratic curve through each corner, at most half of each piece). */
export function pathOfPoints(points: readonly Point[], radius = CORNER_RADIUS): string {
  const first = points[0];
  if (!first) return '';
  let path = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i] as Point;
    const next = points[i + 1];
    const before = points[i - 1] as Point;
    if (!next) {
      path += ` L ${point.x} ${point.y}`;
      continue;
    }
    const inLength = Math.abs(point.x - before.x) + Math.abs(point.y - before.y);
    const outLength = Math.abs(next.x - point.x) + Math.abs(next.y - point.y);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    const from = {
      x: point.x - Math.sign(point.x - before.x) * r,
      y: point.y - Math.sign(point.y - before.y) * r,
    };
    const to = {
      x: point.x + Math.sign(next.x - point.x) * r,
      y: point.y + Math.sign(next.y - point.y) * r,
    };
    path += ` L ${from.x} ${from.y} Q ${point.x} ${point.y} ${to.x} ${to.y}`;
  }
  return path;
}
