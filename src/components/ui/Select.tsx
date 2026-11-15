// Select: native single-choice dropdown with the look of TextField (36 px, radius 10, 3:1 control border).
// Props: invalid (danger border + aria-invalid), mono (IBM Plex Mono, for Power Apps identifiers), plus every
// native select prop; options are plain <option> children. A native element keeps keyboard and screen reader
// behavior for free. Normally rendered inside FormField, which supplies id / aria-describedby.
import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cx, ICON_STROKE_WIDTH } from './cx';
import { fieldBorderClass } from './fieldStyles';

export interface SelectProps extends ComponentProps<'select'> {
  invalid?: boolean;
  mono?: boolean;
}

export function Select({
  invalid = false,
  mono = false,
  className,
  children,
  ...rest
}: SelectProps) {
  return (
    <div className="relative">
      <select
        {...rest}
        aria-invalid={invalid || rest['aria-invalid'] || undefined}
        className={cx(
          'h-9 w-full appearance-none rounded-control border-2 bg-surface pr-9 pl-3 text-ink-900 disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:opacity-45',
          mono ? 'font-mono text-label' : 'text-body-lg',
          fieldBorderClass(invalid),
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={16}
        strokeWidth={ICON_STROKE_WIDTH}
        className="select-chevron pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-500"
      />
    </div>
  );
}
