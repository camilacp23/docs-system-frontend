// Spinner: rotating arc for pending work.
// Props: size ('sm' | 'md' | 'lg', default 'md'); label (accessible name; when omitted the spinner is
// decorative and hidden from assistive technology, e.g. inside a loading Button).
import { cx } from './cx';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: 'size-3.5',
  md: 'size-4.5',
  lg: 'size-6',
};

export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  const svg = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cx('animate-spin motion-reduce:animate-none', SIZE_CLASS[size], className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );

  if (!label) {
    return svg;
  }
  return (
    <span role="status" className="inline-flex">
      {svg}
      <span className="sr-only">{label}</span>
    </span>
  );
}
