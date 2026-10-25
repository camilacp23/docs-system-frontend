// Checkbox: native checkbox drawn with the design tokens, with its label.
// Props: label (the clickable text), invalid (danger border), plus every native input prop (checked, onChange,
// disabled ...). The native input stays in the tab order and keeps its semantics; the box is a sibling drawn
// with `peer`, and its 3:1 border follows the control border token.
import { Check } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cx } from './cx';

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  label: ReactNode;
  invalid?: boolean;
}

export function Checkbox({ label, invalid = false, className, disabled, ...rest }: CheckboxProps) {
  return (
    <label
      className={cx(
        'inline-flex items-center gap-2 text-body-lg text-ink-900',
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative flex size-4.5 shrink-0">
        <input
          {...rest}
          type="checkbox"
          disabled={disabled}
          aria-invalid={invalid || rest['aria-invalid'] || undefined}
          className={cx(
            'peer size-4.5 appearance-none rounded-keycap border bg-surface checked:border-primary checked:bg-primary',
            invalid ? 'border-danger' : 'border-border-control',
          )}
        />
        <Check
          aria-hidden="true"
          size={14}
          strokeWidth={3}
          className="pointer-events-none absolute top-0.5 left-0.5 text-on-primary opacity-0 peer-checked:opacity-100"
        />
      </span>
      {label}
    </label>
  );
}
