// FilterToggle: a pill button that turns a filter on or off ("Authored by me"). A native button with aria-pressed; while on
// it takes the color of its page and shows a check, so the state never depends on color alone.
// Props: pressed, onChange(next), icon (decorative, shown while off), tone (the color of the page), children (the label).
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx, ICON_STROKE_WIDTH } from './cx';
import { FILTER_TONE_ACTIVE, FILTER_TONE_HOVER, type FilterTone } from './filterTones';

export interface FilterToggleProps {
  pressed: boolean;
  onChange: (next: boolean) => void;
  icon: ReactNode;
  tone: FilterTone;
  /** The filter does not apply now (the reason goes in `title`). */
  disabled?: boolean;
  title?: string;
  /** The accessible name when the visible text is shorter than it. */
  ariaLabel?: string;
  children: ReactNode;
}

export function FilterToggle({
  pressed,
  onChange,
  icon,
  tone,
  disabled = false,
  title,
  ariaLabel,
  children,
}: FilterToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      disabled={disabled}
      title={title}
      onClick={() => {
        onChange(!pressed);
      }}
      className={cx(
        'flex h-9 cursor-pointer items-center gap-2 rounded-pill border px-3.5 text-label font-semibold whitespace-nowrap shadow-button transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none',
        pressed
          ? FILTER_TONE_ACTIVE[tone]
          : cx('border-border-subtle bg-surface text-ink-700', FILTER_TONE_HOVER[tone]),
      )}
    >
      {pressed ? (
        <Check aria-hidden="true" size={15} strokeWidth={ICON_STROKE_WIDTH + 0.5} />
      ) : (
        <span aria-hidden="true">{icon}</span>
      )}
      {children}
    </button>
  );
}
