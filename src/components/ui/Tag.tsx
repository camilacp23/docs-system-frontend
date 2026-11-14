// Tag: small pill for a classification (scope, environment, "Untraced"). The meaning is always in the text; the
// tone only reinforces it. Props: tone ('neutral' | 'info' | 'success' | 'warning' | 'danger', default 'neutral'), icon
// (decorative 14 px Lucide element), mono (IBM Plex Mono, for Power Apps identifiers), children.
import type { ReactNode } from 'react';

import { cx } from './cx';

export type TagTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface TagProps {
  tone?: TagTone;
  icon?: ReactNode;
  mono?: boolean;
  children: ReactNode;
  className?: string;
}

const TONE_CLASS: Record<TagTone, string> = {
  neutral: 'border-transparent bg-disabled-bg text-ink-700',
  info: 'border-transparent bg-info-bg text-info-ink',
  success: 'border-transparent bg-success-bg text-success-ink',
  warning: 'border-warning-border bg-warning-bg text-warning-ink',
  danger: 'border-transparent bg-danger-bg text-danger',
};

export function Tag({ tone = 'neutral', icon, mono = false, children, className }: TagProps) {
  return (
    <span
      className={cx(
        'inline-flex h-5.5 items-center gap-1 rounded-pill border px-2.25 text-tag font-bold whitespace-nowrap',
        mono && 'font-mono',
        TONE_CLASS[tone],
        className,
      )}
    >
      {icon && (
        <span aria-hidden="true" className="flex">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
