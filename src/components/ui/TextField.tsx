// TextField: single-line text input (36 px, or 44 px with `large`; radius 10, 2 px border).
// Props: large (44 px, for prominent forms such as sign-in), icon (decorative leading icon), invalid (danger border + aria-invalid), mono (IBM Plex Mono for Power Apps identifiers),
// plus every native input prop. Normally rendered inside FormField, which supplies id / aria-describedby.
import type { ComponentProps, ReactNode } from 'react';

import { cx } from './cx';
import { fieldBorderClass } from './fieldStyles';

export interface TextFieldProps extends ComponentProps<'input'> {
  invalid?: boolean;
  mono?: boolean;
  large?: boolean;
  icon?: ReactNode;
}

const FIELD_CONTROL_CLASS =
  'w-full rounded-control border-2 bg-surface transition-colors duration-150 motion-reduce:transition-none px-3 text-ink-900 placeholder:text-ink-500 disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:opacity-45';

export function TextField({
  invalid = false,
  mono = false,
  large = false,
  icon,
  className,
  ...rest
}: TextFieldProps) {
  const input = (
    <input
      {...rest}
      aria-invalid={invalid || rest['aria-invalid'] || undefined}
      className={cx(
        FIELD_CONTROL_CLASS,
        large ? 'h-11' : 'h-9',
        icon ? 'pl-10' : false,
        mono ? 'font-mono text-label' : 'text-body-lg',
        fieldBorderClass(invalid),
        className,
      )}
    />
  );

  if (!icon) return input;
  return (
    <div className="group relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-500 transition-colors duration-150 group-focus-within:text-accent"
      >
        {icon}
      </span>
      {input}
    </div>
  );
}
