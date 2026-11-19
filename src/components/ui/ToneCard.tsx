// ToneCard: a titled block with a color of its own. Same contract as SectionCard (a <section> named by its title, the
// title is an <h2>), but the header band is tinted with the tone, the icon tile is solid and there is no colored edge: it
// is the card of the "colorful" pages (dashboard, variables). SectionCard stays for the pages that are not redesigned yet.
// Props: title, icon, description, count (small pill), actions, tone ('accent' | 'success' | 'warning' | 'teal' | 'jira' | 'variable' | 'collection' | 'screen' | 'people' | 'apps' | 'find'),
// flush (no body padding: tables, lists), centered (center the body vertically when the card is taller than its
// content), className, children.
import type { ReactNode } from 'react';

import { cx } from './cx';

export type ToneCardTone =
  | 'accent'
  | 'success'
  | 'warning'
  | 'teal'
  | 'jira'
  | 'variable'
  | 'collection'
  | 'screen'
  | 'people'
  | 'apps'
  | 'find';

const TONE: Record<ToneCardTone, { card: string; band: string; tile: string }> = {
  accent: {
    card: 'border-info-border',
    band: 'bg-linear-to-r from-accent-soft to-surface',
    tile: 'bg-accent text-on-primary',
  },
  success: {
    card: 'border-success-border',
    band: 'bg-linear-to-r from-success-bg to-surface',
    tile: 'bg-success text-on-primary',
  },
  warning: {
    card: 'border-warning-border',
    band: 'bg-linear-to-r from-warning-bg to-surface',
    tile: 'bg-badge-warning-bg text-badge-warning-ink',
  },
  jira: {
    card: 'border-jira-border',
    band: 'bg-linear-to-r from-jira-soft to-surface',
    tile: 'bg-jira text-on-primary',
  },
  variable: {
    card: 'border-variable-border',
    band: 'bg-linear-to-r from-variable-soft to-surface',
    tile: 'bg-variable text-on-primary',
  },
  collection: {
    card: 'border-collection-border',
    band: 'bg-linear-to-r from-collection-soft to-surface',
    tile: 'bg-collection text-on-primary',
  },
  screen: {
    card: 'border-screen-border',
    band: 'bg-linear-to-r from-screen-soft to-surface',
    tile: 'bg-screen text-on-primary',
  },
  find: {
    card: 'border-find-border',
    band: 'bg-linear-to-r from-find-soft to-surface',
    tile: 'bg-find text-on-primary',
  },
  apps: {
    card: 'border-apps-border',
    band: 'bg-linear-to-r from-apps-soft to-surface',
    tile: 'bg-apps text-on-primary',
  },
  people: {
    card: 'border-people-border',
    band: 'bg-linear-to-r from-people-soft to-surface',
    tile: 'bg-people text-on-primary',
  },
  teal: {
    card: 'border-primary/20',
    band: 'bg-linear-to-r from-empty-icon-bg to-surface',
    tile: 'bg-primary text-on-primary',
  },
};

export interface ToneCardProps {
  title: string;
  icon?: ReactNode;
  description?: ReactNode;
  count?: number | null;
  actions?: ReactNode;
  tone?: ToneCardTone;
  flush?: boolean;
  centered?: boolean;
  className?: string;
  children: ReactNode;
}

export function ToneCard({
  title,
  icon,
  description,
  count,
  actions,
  tone = 'accent',
  flush = false,
  centered = false,
  className,
  children,
}: ToneCardProps) {
  const style = TONE[tone];
  return (
    <section
      aria-label={title}
      className={cx(
        'flex shrink-0 flex-col overflow-hidden rounded-modal border bg-surface shadow-card',
        style.card,
        className,
      )}
    >
      <div className={cx('flex items-center gap-3 px-4 py-3', style.band)}>
        {icon && (
          <span
            aria-hidden="true"
            className={cx(
              'flex size-8 shrink-0 items-center justify-center rounded-control shadow-button',
              style.tile,
            )}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-body font-bold text-ink-900">{title}</h2>
          {description && <p className="truncate text-small text-ink-700">{description}</p>}
        </div>
        {count !== undefined && count !== null && (
          <span className="rounded-pill bg-surface px-2.5 py-0.5 text-label font-bold text-ink-700 shadow-button">
            {count}
          </span>
        )}
        {actions}
      </div>
      <div
        className={cx(
          'flex flex-1 flex-col',
          !flush && 'px-4 py-3.5',
          centered && 'justify-center',
        )}
      >
        {children}
      </div>
    </section>
  );
}
