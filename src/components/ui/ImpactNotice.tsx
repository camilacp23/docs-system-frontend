// ImpactNotice: highlighted block that states what an action takes with it (e.g. the links a delete removes).
// Props: children (the sentence, already written by the caller), tone ('danger' red | 'warning' amber, default
// 'danger'). Icon + tinted panel make the consequence stand out from the rest of a confirmation dialog.
import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx, ICON_STROKE_WIDTH } from './cx';

export interface ImpactNoticeProps {
  tone?: 'danger' | 'warning';
  children: ReactNode;
}

export function ImpactNotice({ tone = 'danger', children }: ImpactNoticeProps) {
  return (
    <div
      className={cx(
        'flex items-start gap-3 rounded-control border px-4 py-3.5',
        tone === 'danger'
          ? 'border-danger-border bg-danger-bg text-danger'
          : 'border-warning-border bg-warning-bg text-warning-ink',
      )}
    >
      <TriangleAlert
        aria-hidden="true"
        size={18}
        strokeWidth={ICON_STROKE_WIDTH}
        className="mt-0.5 shrink-0"
      />
      <div className="min-w-0 flex-1 text-body-lg text-ink-900">{children}</div>
    </div>
  );
}
