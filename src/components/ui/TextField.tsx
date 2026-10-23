// TextField: single-line text input (36 px, radius 10, 1 px border).
// Props: invalid (danger border + aria-invalid), mono (IBM Plex Mono for Power Apps identifiers),
// plus every native input prop. Normally rendered inside FormField, which supplies id / aria-describedby.
import type { ComponentProps } from 'react';

import { cx } from './cx';

export interface TextFieldProps extends ComponentProps<'input'> {
  invalid?: boolean;
  mono?: boolean;
}

const FIELD_CONTROL_CLASS =
  'h-9 w-full rounded-control border bg-surface px-3 text-ink-900 placeholder:text-ink-500 disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:opacity-45';

export function TextField({ invalid = false, mono = false, className, ...rest }: TextFieldProps) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || rest['aria-invalid'] || undefined}
      className={cx(
        FIELD_CONTROL_CLASS,
        mono ? 'font-mono text-label' : 'text-body-lg',
        invalid
          ? 'border-danger'
          : 'border-border focus:border-accent enabled:hover:border-border-hover',
        className,
      )}
    />
  );
}
