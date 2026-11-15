// edgeStyles: one line style per edge kind (frame S-27c legend), drawn with the built-in React Flow edge type.
// EDGE_STYLE[kind] -> { stroke (a design token), strokeWidth, strokeDasharray }; edgeStyleOf(kind) returns it as the
// `style` of an edge or of the legend sample. Color alone never tells the kinds apart (WCAG 1.4.1): each kind also
// has its own width and dash pattern, and the legend draws both.
// The colors are existing tokens; the frame does not give an exact color per kind (pending design confirmation).
import type { CSSProperties } from 'react';

import type { EdgeKind } from './graphTypes';

interface EdgeLineStyle {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

export const EDGE_STYLE: Record<EdgeKind, EdgeLineStyle> = {
  CONTAINS: { stroke: 'var(--color-border-control)', strokeWidth: 1.25 },
  CREATES: { stroke: 'var(--color-ink-900)', strokeWidth: 2.75 },
  ACCESSES: { stroke: 'var(--color-ink-700)', strokeWidth: 1.5, strokeDasharray: '10 4' },
  FEEDS: { stroke: 'var(--color-accent)', strokeWidth: 2, strokeDasharray: '5 4' },
  USES: { stroke: 'var(--color-ink-500)', strokeWidth: 2, strokeDasharray: '1 4' },
  DERIVES_FROM: { stroke: 'var(--color-success)', strokeWidth: 3.25 },
  NAVIGATES_TO: { stroke: 'var(--color-primary)', strokeWidth: 2 },
};

export function edgeStyleOf(kind: EdgeKind): CSSProperties {
  const { stroke, strokeWidth, strokeDasharray } = EDGE_STYLE[kind];
  return {
    stroke,
    strokeWidth,
    ...(strokeDasharray ? { strokeDasharray, strokeLinecap: 'round' } : {}),
  };
}
