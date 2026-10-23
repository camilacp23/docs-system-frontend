// EmptyState: icon, title, one sentence of help and, when the role can act, one action (S-40a).
// Props: icon (Lucide element, e.g. <Database />), title, description, action (a primary Button, omit when
// the role cannot act). Meant to sit inside a card; it draws no border of its own.
import type { ReactNode } from 'react';

import { cx } from './cx';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx('flex flex-col items-center gap-2.5 px-6 py-14 text-center', className)}>
      <div
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-pill bg-empty-icon-bg text-primary [&>svg]:size-6.5"
      >
        {icon}
      </div>
      <h2 className="text-subheading font-semibold text-ink-900">{title}</h2>
      <p className="max-w-105 text-body-lg text-ink-500">{description}</p>
      {action && <div className="flex flex-wrap items-center gap-y-2">{action}</div>}
    </div>
  );
}
