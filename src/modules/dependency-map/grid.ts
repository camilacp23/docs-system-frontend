// grid: the 8 px grid of the dependency map. Every box of every view has a size and a position that are multiples of PITCH,
// so the lines that connect them can be routed on the same grid (see edgeRouting): a line runs on grid lines, two lines never
// share one, and each line leaves a box through its own port, a slot of the side of the box.
//   PITCH         distance between two grid lines, and between two ports of a side.
//   PORT_MARGIN   the first and the last port of a side keep this distance from the corner (so a line never hugs it).
//   snap(v)       the nearest multiple of PITCH; snapUp(v) the next one.
//   portCount(h)  how many ports fit on a side of height h; portOffsets(h) their offsets from the top of the box.
//   heightFor(base, degree)  the height a box needs to give each of its `degree` lines its own port: boxes with many
//                 connections grow, so lines never have to share a point of the border.
export const PITCH = 8;
export const PORT_MARGIN = 16;

export const snap = (value: number): number => Math.round(value / PITCH) * PITCH;
export const snapUp = (value: number): number => Math.ceil(value / PITCH) * PITCH;

export function portCount(height: number): number {
  return Math.max(0, Math.floor((height - 2 * PORT_MARGIN) / PITCH) + 1);
}

export function portOffsets(height: number): number[] {
  return Array.from({ length: portCount(height) }, (_, index) => PORT_MARGIN + index * PITCH);
}

export function heightFor(base: number, degree: number): number {
  return Math.max(base, snapUp(2 * PORT_MARGIN + Math.max(0, degree - 1) * PITCH));
}
