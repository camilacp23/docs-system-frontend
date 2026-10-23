// Helpers shared by the design-system components: class-name joiner and the Lucide stroke width.

/** Joins class names, skipping falsy parts. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Stroke width of every Lucide icon, matching the icons exported from Figma (1.75 in the 24-unit grid). */
export const ICON_STROKE_WIDTH = 1.75;
