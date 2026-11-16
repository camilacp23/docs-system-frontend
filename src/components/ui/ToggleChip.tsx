// ToggleChip: a chip that is on or off, for a multiple choice among a few options (the "Include" and "Documentation
// status" chips of S-34). A native button with aria-pressed, so Space and Enter work and the state is announced.
// Props: pressed, onChange(next), children (the label), disabled (flat look; stays out of the tab order like a Button),
// invalid (danger border), aria-describedby. A pressed chip shows a check, so the state never depends on color alone.
// Put the chips in a role="group" named by the field label.
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx, ICON_STROKE_WIDTH } from './cx';

export interface ToggleChipProps {
  pressed: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  'aria-describedby'?: string;
}

export function ToggleChip({
  pressed,
  onChange,
  children,
  disabled = false,
  invalid = false,
  className,
  'aria-describedby': describedBy,
}: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => {
        onChange(!pressed);
      }}
      className={cx(
        'inline-flex h-8 items-center gap-1.5 rounded-pill border px-3.25 text-label font-medium whitespace-nowrap',
        pressed ? 'bg-empty-icon-bg text-primary' : 'bg-surface text-ink-700',
        invalid ? 'border-danger' : pressed ? 'border-primary' : 'border-border-control',
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
        className,
      )}
    >
      {pressed && <Check aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />}
      {children}
    </button>
  );
}
