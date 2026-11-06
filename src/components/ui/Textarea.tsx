// Textarea: multi-line text input with the look of TextField (radius 10, 3:1 control border).
// Props: invalid (danger border + aria-invalid), plus every native textarea prop (rows defaults to 3).
// Normally rendered inside FormField, which supplies id / aria-describedby.
import type { ComponentProps } from 'react';

import { cx } from './cx';
import { fieldBorderClass } from './fieldStyles';

export interface TextareaProps extends ComponentProps<'textarea'> {
  invalid?: boolean;
}

export function Textarea({ invalid = false, className, rows = 3, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      rows={rows}
      aria-invalid={invalid || rest['aria-invalid'] || undefined}
      className={cx(
        'w-full resize-y rounded-control border-2 bg-surface px-3 py-2 text-body-lg text-ink-900 placeholder:text-ink-500 disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:opacity-45',
        fieldBorderClass(invalid),
        className,
      )}
    />
  );
}
