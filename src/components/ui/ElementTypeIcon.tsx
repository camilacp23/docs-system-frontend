// ElementTypeIcon: one Lucide icon per element type (SDD Table 54): monitor = screen, braces = variable,
// database = collection, box = component. The type is told by shape, not by color: the icon inherits the
// text color (decision of F-01, the Figma file defines no per-type color).
// Props: type, size (px, default 16), label (accessible name; omit when the type is already named in text).
import { Box, Braces, Database, Monitor } from 'lucide-react';

import { ICON_STROKE_WIDTH } from './cx';

export type ElementType = 'screen' | 'variable' | 'collection' | 'component';

export interface ElementTypeIconProps {
  type: ElementType;
  size?: number;
  label?: string;
  className?: string;
}

const ICON_BY_TYPE = {
  screen: Monitor,
  variable: Braces,
  collection: Database,
  component: Box,
} as const;

export function ElementTypeIcon({ type, size = 16, label, className }: ElementTypeIconProps) {
  const Icon = ICON_BY_TYPE[type];
  return (
    <Icon
      size={size}
      strokeWidth={ICON_STROKE_WIDTH}
      className={className}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    />
  );
}
