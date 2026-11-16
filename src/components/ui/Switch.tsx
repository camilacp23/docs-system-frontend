// Switch: an on/off setting that applies at once (the "Published" switch of a report, S-33; the two options of S-34).
// Props: checked, onChange(next), label (the visible text; it is also the accessible name), description (second line
// under the label, optional), disabled, disabledReason (why it cannot be changed now: shown as a tooltip and read
// by assistive technology), loading (a change is being sent: it ignores presses and sets aria-busy), reverse (the
// control at the right of the text, as in the options of S-34), id and aria-describedby.
// It is a native button with role="switch" and aria-checked, so Space and Enter work. A disabled switch stays in
// the tab order (aria-disabled, no change on press) so the keyboard user can reach it and hear the reason.
import { useId } from 'react';
import type { ReactNode } from 'react';

import { cx } from './cx';

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
  reverse?: boolean;
  id?: string;
  className?: string;
  'aria-describedby'?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  disabledReason,
  loading = false,
  reverse = false,
  id,
  className,
  'aria-describedby': describedBy,
}: SwitchProps) {
  const generated = useId();
  const buttonId = id ?? generated;
  const reasonId = `${buttonId}-reason`;
  const descriptionId = `${buttonId}-description`;
  const inactive = disabled || loading;
  const describedIds =
    [
      description ? descriptionId : null,
      disabled && disabledReason ? reasonId : null,
      describedBy ?? null,
    ]
      .filter((value): value is string => value !== null)
      .join(' ') || undefined;

  return (
    <div
      className={cx(
        'flex items-center gap-2.5',
        reverse && 'flex-row-reverse justify-between',
        className,
      )}
      title={disabled ? disabledReason : undefined}
    >
      <button
        type="button"
        id={buttonId}
        role="switch"
        aria-checked={checked}
        aria-disabled={inactive || undefined}
        aria-busy={loading || undefined}
        aria-labelledby={`${buttonId}-label`}
        aria-describedby={describedIds}
        onClick={() => {
          if (!inactive) onChange(!checked);
        }}
        className={cx(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-pill border border-transparent transition-colors',
          checked ? 'bg-success' : 'bg-border-control',
          inactive ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'size-4 rounded-pill bg-surface shadow-button transition-transform motion-reduce:transition-none',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          )}
        />
      </button>
      <span className="flex min-w-0 flex-col">
        <label
          id={`${buttonId}-label`}
          htmlFor={buttonId}
          className={cx(
            'text-label font-medium text-ink-900',
            inactive ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
        >
          {label}
        </label>
        {description && (
          <span id={descriptionId} className="text-small text-ink-500">
            {description}
          </span>
        )}
      </span>
      {disabled && disabledReason && (
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
      )}
    </div>
  );
}
