// ChoiceCard: one card of a short list of mutually exclusive choices that need a title and a sentence (the PDF / Excel
// format of S-34). Built on a native radio input, so arrow keys, focus and screen readers work as a radio group.
// Props: name (radio group name), value, checked, onChange(value), title, description, badge (the small tile at the
// left, e.g. the "PDF" mark; decorative), disabled, invalid, aria-describedby. Put the cards in a role="radiogroup"
// (or a fieldset) named by the field label.
import type { ReactNode } from 'react';

import { cx } from './cx';

export interface ChoiceCardProps<V extends string> {
  name: string;
  value: V;
  checked: boolean;
  onChange: (value: V) => void;
  title: ReactNode;
  description: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  'aria-describedby'?: string;
}

export function ChoiceCard<V extends string>({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  badge,
  disabled = false,
  invalid = false,
  className,
  'aria-describedby': describedBy,
}: ChoiceCardProps<V>) {
  return (
    <label
      className={cx(
        'relative flex items-center gap-3 rounded-control border bg-surface px-3.5 py-3 has-checked:border-primary has-checked:bg-empty-icon-bg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring',
        invalid ? 'border-danger' : 'border-border-control',
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={() => {
          onChange(value);
        }}
        className="peer sr-only"
      />
      {badge && <span aria-hidden="true">{badge}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-lg font-semibold text-ink-900">{title}</span>
        <span className="text-small text-ink-500">{description}</span>
      </span>
      <span
        aria-hidden="true"
        className="flex size-4.5 shrink-0 items-center justify-center rounded-pill border border-border-control bg-surface peer-checked:border-primary peer-checked:[&>span]:opacity-100"
      >
        <span className="size-2.5 rounded-pill bg-primary opacity-0" />
      </span>
    </label>
  );
}
