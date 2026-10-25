// SegmentedControl: a short list of mutually exclusive choices drawn as joined segments (scope of S-12a, scope
// tabs of S-10). Built on native radio inputs, so arrow keys, focus and screen readers work as a radio group.
// Props: name (radio group name), label (accessible name of the group), options ({ value, label, disabled?,
// title? }; `title` explains a disabled option), value, onChange(value), invalid (danger border), disabled.
import type { ReactNode } from 'react';

import { cx } from './cx';

export interface SegmentedOption<V extends string> {
  value: V;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
}

export interface SegmentedControlProps<V extends string> {
  name: string;
  label: string;
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-describedby'?: string;
}

export function SegmentedControl<V extends string>({
  name,
  label,
  options,
  value,
  onChange,
  invalid = false,
  disabled = false,
  className,
  'aria-describedby': describedBy,
}: SegmentedControlProps<V>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={cx(
        'inline-flex gap-0.5 rounded-control border bg-search-bg p-0.5',
        invalid ? 'border-danger' : 'border-border-control',
        className,
      )}
    >
      {options.map((option) => {
        const optionDisabled = disabled || option.disabled === true;
        return (
          <label
            key={option.value}
            title={option.title}
            className={cx(
              'relative flex h-7.5 flex-1 items-center justify-center rounded-chip px-3.5 text-label font-semibold whitespace-nowrap has-checked:bg-surface has-checked:text-ink-900 has-checked:shadow-card has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring',
              optionDisabled
                ? 'cursor-not-allowed text-ink-500 opacity-45'
                : 'cursor-pointer text-ink-700',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={optionDisabled}
              onChange={() => {
                onChange(option.value);
              }}
              className="absolute inset-0 size-full cursor-[inherit] opacity-0 outline-none"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
