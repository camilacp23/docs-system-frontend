// canvasFit: where the first view of the map is, and what the chrome of the canvas takes. Pure functions, so they are tested
// without a browser.
// fitViewport({ content, anchor, canvas }) -> { x, y, zoom, insets, fits }: the viewport of the first view and of "fit view".
//   - It RESERVES the room of the chrome (INSETS: the bar at the top, the zoom controls at the right and, when the map does not
//     fit, the mini map next to them): the framed boxes start in the free part of the canvas, none under the chrome.
//   - It is READABLE: the content is shown at the zoom that fits it, at most FIT_MAX_ZOOM (a small map is not enlarged) and never
//     below READABLE_MIN_ZOOM (the text stays about 9 px or more). If it fits it is centered in the free part; if it does not,
//     it starts at its top left corner, or is centered on the `anchor` (the focused element) when there is one.
// overflowsCanvas(bounds, viewport, canvas) -> true when the map, drawn with this viewport, goes past the free part of the canvas:
//   then the mini map is shown.
// chromeRects(canvas, minimap) -> the rectangles of the canvas the chrome covers, in pixels of the canvas.
import type { Rect } from './edgeRouting';

/** The smallest zoom of the first view and of "fit view": 13 px text is about 9 px here. */
export const READABLE_MIN_ZOOM = 0.7;
/** A small map is not enlarged past its real size. */
export const FIT_MAX_ZOOM = 1;
/**
 * The room the chrome takes at the sides of the canvas, in pixels: the bar at the top, the zoom controls at the right and,
 * when the map does not fit, the mini map next to them.
 */
export const INSETS = { top: 56, right: 72, bottom: 24, left: 24 };
export const MINIMAP_SIZE = { width: 168, height: 112 };
export const MINIMAP_RIGHT_INSET = INSETS.right + MINIMAP_SIZE.width + 16;

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface FitResult extends Viewport {
  insets: Insets;
  /** True when the content fits the free part of the canvas at READABLE_MIN_ZOOM or more. */
  fits: boolean;
}

export function fitViewport({
  content,
  anchor,
  canvas,
}: {
  content: Rect;
  anchor: Rect | null;
  canvas: { width: number; height: number };
}): FitResult {
  const place = (insets: Insets) => {
    const room = {
      width: Math.max(1, canvas.width - insets.left - insets.right),
      height: Math.max(1, canvas.height - insets.top - insets.bottom),
    };
    const raw = Math.min(
      room.width / Math.max(1, content.width),
      room.height / Math.max(1, content.height),
    );
    return { room, raw, zoom: Math.min(FIT_MAX_ZOOM, Math.max(READABLE_MIN_ZOOM, raw)) };
  };
  let insets: Insets = INSETS;
  let placed = place(insets);
  if (placed.raw < READABLE_MIN_ZOOM) {
    // It does not fit: the mini map will be there, so its room is reserved too.
    insets = { ...INSETS, right: MINIMAP_RIGHT_INSET };
    placed = place(insets);
  }
  const { room, zoom, raw } = placed;
  const fits = raw >= READABLE_MIN_ZOOM;
  let x: number;
  let y: number;
  if (fits) {
    x = insets.left + (room.width - content.width * zoom) / 2 - content.x * zoom;
    y = insets.top + (room.height - content.height * zoom) / 2 - content.y * zoom;
  } else if (anchor) {
    const cx = anchor.x + anchor.width / 2;
    const cy = anchor.y + anchor.height / 2;
    x = insets.left + room.width / 2 - cx * zoom;
    y = insets.top + room.height / 2 - cy * zoom;
  } else {
    x = insets.left - content.x * zoom;
    y = insets.top - content.y * zoom;
  }
  return { x, y, zoom, insets, fits };
}

export function overflowsCanvas(
  bounds: Rect,
  viewport: Viewport,
  canvas: { width: number; height: number },
): boolean {
  const left = bounds.x * viewport.zoom + viewport.x;
  const top = bounds.y * viewport.zoom + viewport.y;
  const right = (bounds.x + bounds.width) * viewport.zoom + viewport.x;
  const bottom = (bounds.y + bounds.height) * viewport.zoom + viewport.y;
  const tolerance = 1;
  return (
    left < INSETS.left - tolerance ||
    top < INSETS.top - tolerance ||
    right > canvas.width - INSETS.right + tolerance ||
    bottom > canvas.height - INSETS.bottom + tolerance
  );
}

/** What the chrome covers: the bar at the top, the column of zoom controls, and the mini map when it is shown. */
export function chromeRects(canvas: { width: number; height: number }, minimap: boolean): Rect[] {
  const rects: Rect[] = [
    { x: 0, y: 0, width: canvas.width, height: INSETS.top - 8 },
    {
      x: canvas.width - INSETS.right + 8,
      y: 0,
      width: INSETS.right - 8,
      height: canvas.height,
    },
  ];
  if (minimap) {
    rects.push({
      x: canvas.width - MINIMAP_RIGHT_INSET + 8,
      y: canvas.height - MINIMAP_SIZE.height - INSETS.bottom + 8,
      width: MINIMAP_SIZE.width,
      height: MINIMAP_SIZE.height + INSETS.bottom - 8,
    });
  }
  return rects;
}
