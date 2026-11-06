// SectionCard: a titled card for one block of a page (list, details, usage, a group of form fields). The header
// gives each block its own identity: a colored edge, an icon tile colored by `tone`, the title, an optional one-line
// description, a count and/or actions on the right; a tinted header band separates it from the body.
// Props: title (also the accessible name of the region), icon, description, count (small pill), actions,
// tone ('accent' | 'success' | 'warning' | 'neutral', default 'accent'), flush (no body padding: tables, lists),
// className. children = the body.
import type { ReactNode } from 'react';

import { cx } from './cx';
import { SECTION_TONE_TILE } from './sectionTones';
import type { SectionTone } from './sectionTones';

export interface SectionCardProps {
  title: string;
  icon?: ReactNode;
  description?: ReactNode;
  count?: number | null;
  actions?: ReactNode;
  tone?: SectionTone;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

const TONE_EDGE: Record<SectionTone, string> = {
  accent: 'before:bg-accent',
  success: 'before:bg-success',
  warning: 'before:bg-badge-warning-bg',
  neutral: 'before:bg-border',
};

export function SectionCard({
  title,
  icon,
  description,
  count,
  actions,
  tone = 'accent',
  flush = false,
  className,
  children,
}: SectionCardProps) {
  return (
    <section
      aria-label={title}
      className={cx(
        'relative overflow-hidden rounded-card border border-border-subtle bg-surface shadow-card before:absolute before:inset-y-0 before:left-0 before:w-1',
        TONE_EDGE[tone],
        className,
      )}
    >
      <header className="flex items-center gap-3 border-b border-divider bg-modal-footer-bg py-3 pr-4 pl-5">
        {icon && (
          <span
            aria-hidden="true"
            className={cx(
              'flex size-8 shrink-0 items-center justify-center rounded-chip',
              SECTION_TONE_TILE[tone],
            )}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-body-lg font-semibold text-ink-900">{title}</h2>
          {description && <p className="truncate text-small text-ink-500">{description}</p>}
        </div>
        {count !== undefined && count !== null && (
          <span className="rounded-pill bg-disabled-bg px-2.5 py-0.5 text-label font-semibold text-ink-700">
            {count}
          </span>
        )}
        {actions}
      </header>
      <div className={cx(!flush && 'px-5 py-4')}>{children}</div>
    </section>
  );
}
