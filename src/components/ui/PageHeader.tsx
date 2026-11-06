// PageHeader: the top of a page: an icon tile, the page title (h1), a one-line description and the page actions.
// Props: title, icon, description, meta (row under the description: tags, timestamps), actions (buttons on the
// right), className. It sets the first level of the visual hierarchy: icon + 20 px title > description > meta.
import type { ReactNode } from 'react';

import { cx } from './cx';

export interface PageHeaderProps {
  title: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  icon,
  description,
  meta,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cx('flex items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 items-center gap-3.5">
        {icon && (
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-control bg-(image:--gradient-app-tile) text-on-primary"
          >
            {icon}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-title font-bold text-ink-900">{title}</h1>
          {description && <div className="text-body text-ink-500">{description}</div>}
          {meta && <div className="mt-0.5 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
