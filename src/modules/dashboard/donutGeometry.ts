// donutGeometry: the shapes of the status donut (S-31) as SVG paths, calculated from the counts. A pure function of
// its input: the same counts give the same paths, so it is tested without drawing anything.
// donutSegments(counts, options?) -> [{ index, d, fraction }], one per count above 0, in the order of `counts`,
// clockwise from 12 o'clock. A count of 0 has no segment. A single segment that holds everything is a full ring.
// Between two segments there is a gap of `gap` units (2 px in the chart) measured on the middle of the ring; a very
// thin segment keeps at least half of its width so it never disappears.
export interface DonutOptions {
  /** Side of the square viewBox. */
  size?: number;
  outer?: number;
  inner?: number;
  /** Width of the empty space between two segments, in viewBox units. */
  gap?: number;
}

export interface DonutSegment {
  index: number;
  d: string;
  /** The share of the total, between 0 and 1. */
  fraction: number;
}

export const DONUT_SIZE = 220;
export const DONUT_OUTER = 100;
export const DONUT_INNER = 68;
export const DONUT_GAP = 2;

const FULL_TURN = Math.PI * 2;
const START = -Math.PI / 2;

function num(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function point(center: number, radius: number, angle: number): string {
  return `${num(center + radius * Math.cos(angle))} ${num(center + radius * Math.sin(angle))}`;
}

/** The ring between two radii as one closed path (two half turns on each edge, drawn with the even-odd rule). */
function ringPath(center: number, outer: number, inner: number): string {
  const top = (radius: number) => `${num(center)} ${num(center - radius)}`;
  const bottom = (radius: number) => `${num(center)} ${num(center + radius)}`;
  const circle = (radius: number) =>
    `M ${top(radius)} A ${radius} ${radius} 0 1 1 ${bottom(radius)} A ${radius} ${radius} 0 1 1 ${top(radius)} Z`;
  return `${circle(outer)} ${circle(inner)}`;
}

export function donutSegments(
  counts: readonly number[],
  {
    size = DONUT_SIZE,
    outer = DONUT_OUTER,
    inner = DONUT_INNER,
    gap = DONUT_GAP,
  }: DonutOptions = {},
): DonutSegment[] {
  const total = counts.reduce((sum, count) => sum + Math.max(count, 0), 0);
  if (total <= 0) return [];
  const center = size / 2;
  const present = counts.filter((count) => count > 0).length;
  const gapAngle = gap / ((outer + inner) / 2);
  const segments: DonutSegment[] = [];
  let angle = START;
  counts.forEach((count, index) => {
    if (count <= 0) return;
    const fraction = count / total;
    const width = fraction * FULL_TURN;
    if (present === 1) {
      segments.push({ index, d: ringPath(center, outer, inner), fraction });
      return;
    }
    const inset = Math.min(gapAngle / 2, width / 4);
    const from = angle + inset;
    const to = angle + width - inset;
    const large = to - from > Math.PI ? 1 : 0;
    segments.push({
      index,
      fraction,
      d:
        `M ${point(center, outer, from)} A ${outer} ${outer} 0 ${large} 1 ${point(center, outer, to)} ` +
        `L ${point(center, inner, to)} A ${inner} ${inner} 0 ${large} 0 ${point(center, inner, from)} Z`,
    });
    angle += width;
  });
  return segments;
}
