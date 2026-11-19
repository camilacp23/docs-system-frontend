// FilterSelect: a pill select for a filter bar: icon, small caption and the native <select> (keyboard and screen readers
// for free). A select with a value turns the color of its page, so the active filters can be seen at a glance.
// Props: label (caption and accessible name), icon (decorative), value, onChange(next), tone ('variable' | 'collection' | 'screen' | 'accent':
// the color of the page that uses it), children (the <option>s; the one with value "" is the "no filter").
import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';

import { cx, ICON_STROKE_WIDTH } from './cx';
import {
  FILTER_TONE_ACTIVE,
  FILTER_TONE_FOCUS,
  FILTER_TONE_HOVER,
  type FilterTone,
} from './filterTones';

export interface FilterSelectProps {
  label: string;
  /** The text drawn in the pill when it is shorter than the accessible name (`label`). */
  caption?: string;
  icon: ReactNode;
  value: string;
  onChange: (next: string) => void;
  tone: FilterTone;
  /** What the filter applies to, read to assistive technology with the select (aria-describedby). */
  description?: string;
  /** The select is in error (danger border and aria-invalid). */
  invalid?: boolean;
  /** Id of an element that describes the select (an error text). */
  describedBy?: string;
  /** Widest the select may grow before cutting its text (default `max-w-36`); long choices pass a wider one. */
  selectClassName?: string;
  /** The pill fills the width it is given (a filter bar laid out in columns) instead of the width of its text. */
  fullWidth?: boolean;
  /** The value that means "no filter" (default ''): the pill takes the color of its page only when the value differs. */
  neutralValue?: string;
  /** The filter does not apply now (the reason goes in `title`). */
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}

export function FilterSelect({
  label,
  caption,
  icon,
  value,
  onChange,
  tone,
  description,
  invalid = false,
  describedBy,
  selectClassName = 'max-w-36',
  fullWidth = false,
  neutralValue = '',
  disabled = false,
  title,
  children,
}: FilterSelectProps) {
  const descriptionId = useId();
  const active = value !== neutralValue;
  return (
    <div
      title={title}
      className={cx(
        disabled && 'opacity-45',
        fullWidth && 'w-full',
        'relative flex h-9 items-center gap-2 rounded-pill border pr-8 pl-3.5 shadow-button transition-colors duration-150 motion-reduce:transition-none',
        invalid
          ? 'border-danger bg-surface text-ink-900'
          : active
            ? FILTER_TONE_ACTIVE[tone]
            : cx(
                'border-border-subtle bg-surface text-ink-700',
                FILTER_TONE_HOVER[tone],
                FILTER_TONE_FOCUS[tone],
              ),
      )}
    >
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <span aria-hidden="true" className="shrink-0 text-small font-medium opacity-80">
        {caption ?? label}
      </span>
      <select
        aria-label={label}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={
          [description === undefined ? null : descriptionId, describedBy ?? null]
            .filter((id) => id !== null)
            .join(' ') || undefined
        }
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={cx(
          "min-w-14 cursor-pointer appearance-none bg-transparent text-label font-bold outline-none before:absolute before:inset-0 before:content-[''] hover:bg-transparent focus-visible:outline-none",
          fullWidth && 'min-w-0 flex-1',
          selectClassName,
        )}
      >
        {children}
      </select>
      {description !== undefined && (
        <span id={descriptionId} className="sr-only">
          {description}
        </span>
      )}
      <ChevronDown
        aria-hidden="true"
        size={14}
        strokeWidth={ICON_STROKE_WIDTH}
        className="select-chevron pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 opacity-70"
      />
    </div>
  );
}
