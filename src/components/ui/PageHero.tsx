// PageHero: the top of a redesigned page, on a surface of its own instead of floating on the page background: a solid icon
// tile, the title (the page's h1), a one-line description and the page actions on the right. An optional `corner` element
// (a small chip such as "Updated 10:24") is pinned to the top-right.
// Props: title, icon, description, actions, corner, className, and the look:
//   tone  'accent' (blue, default) | 'variable' (cerulean) | 'collection' (royal blue) | 'screen' (indigo) | 'report' (bronze gold) | 'onboarding' (sky blue) | 'review' (amber) | 'audit' (teal) | 'people' (plum) | 'apps' (forest green) | 'map' (coral rose) | 'find' (slate navy): the color of the page;
//   compact false (default): 44 px icon tile; true: 40 px tile with an 18 px icon, for the pages of one element (detail).
// PageHeader stays for the pages not redesigned yet.
import type { ReactNode, Ref } from 'react';

import { cx } from './cx';

export type PageHeroTone =
  | 'accent'
  | 'variable'
  | 'collection'
  | 'screen'
  | 'report'
  | 'onboarding'
  | 'review'
  | 'audit'
  | 'people'
  | 'apps'
  | 'map'
  | 'find';

export interface PageHeroProps {
  title: ReactNode;
  /** Makes the title focusable by code (to move the focus there after an action). */
  titleRef?: Ref<HTMLHeadingElement>;
  icon: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  corner?: ReactNode;
  tone?: PageHeroTone;
  compact?: boolean;
  className?: string;
}

const BORDER: Record<PageHeroTone, string> = {
  accent: 'border-info-border',
  variable: 'border-variable-border',
  collection: 'border-collection-border',
  screen: 'border-screen-border',
  report: 'border-report-border',
  onboarding: 'border-onboarding-border',
  review: 'border-review-border',
  audit: 'border-audit-border',
  people: 'border-people-border',
  apps: 'border-apps-border',
  map: 'border-map-border',
  find: 'border-find-border',
};

const TILE: Record<PageHeroTone, string> = {
  accent: 'bg-(image:--gradient-app-tile)',
  variable: 'bg-(image:--gradient-variable)',
  collection: 'bg-(image:--gradient-collection)',
  screen: 'bg-(image:--gradient-screen)',
  report: 'bg-(image:--gradient-report)',
  onboarding: 'bg-(image:--gradient-onboarding)',
  review: 'bg-(image:--gradient-review)',
  audit: 'bg-(image:--gradient-audit)',
  people: 'bg-(image:--gradient-people)',
  apps: 'bg-(image:--gradient-apps)',
  map: 'bg-(image:--gradient-map)',
  find: 'bg-(image:--gradient-find)',
};

export function PageHero({
  title,
  titleRef,
  icon,
  description,
  actions,
  corner,
  tone = 'accent',
  compact = false,
  className,
}: PageHeroProps) {
  return (
    <div
      className={cx(
        'relative flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-modal border px-5 py-4 shadow-card',
        'bg-surface',
        BORDER[tone],
        corner !== undefined && corner !== null && corner !== false && 'pt-8',
        className,
      )}
    >
      {corner && <div className="absolute top-3 right-4">{corner}</div>}
      <div className="flex min-w-0 items-center gap-3.5">
        <span
          aria-hidden="true"
          className={cx(
            compact ? 'size-10 rounded-control' : 'size-11 rounded-card',
            'flex shrink-0 items-center justify-center text-on-primary shadow-nav-tile',
            TILE[tone],
          )}
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h1
            ref={titleRef}
            tabIndex={titleRef ? -1 : undefined}
            className="truncate text-title font-bold text-ink-900 focus:outline-none"
          >
            {title}
          </h1>
          {description && <div className="text-body text-ink-700">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
