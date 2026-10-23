// StatusTag: pill with a dot and the label of a documentation status (same tag in lists, details, map, search).
// Props: status ('undocumented' | 'draft' | 'in-progress' | 'in-review' | 'approved'). The label is fixed by the
// status, so the meaning never depends on color alone.
import { cx } from './cx';
import { DOCUMENTATION_STATUS_LABEL } from './documentationStatus';
import type { DocumentationStatus } from './documentationStatus';

export interface StatusTagProps {
  status: DocumentationStatus;
  className?: string;
}

const STATUS_CLASS: Record<DocumentationStatus, { pill: string; dot: string }> = {
  undocumented: {
    pill: 'border-dashed border-status-undocumented-border bg-status-undocumented-bg text-status-undocumented-ink',
    dot: 'bg-status-undocumented-ink',
  },
  draft: {
    pill: 'border-transparent bg-status-draft-bg text-status-draft-ink',
    dot: 'bg-status-draft-ink',
  },
  'in-progress': {
    pill: 'border-transparent bg-status-in-progress-bg text-status-in-progress-ink',
    dot: 'bg-status-in-progress-ink',
  },
  'in-review': {
    pill: 'border-transparent bg-status-in-review-bg text-status-in-review-ink',
    dot: 'bg-status-in-review-ink',
  },
  approved: {
    pill: 'border-transparent bg-status-approved-bg text-status-approved-ink',
    dot: 'bg-status-approved-ink',
  },
};

export function StatusTag({ status, className }: StatusTagProps) {
  const { pill, dot } = STATUS_CLASS[status];
  return (
    <span
      className={cx(
        'inline-flex h-5.5 items-center gap-1 rounded-pill border px-2.25 text-tag font-bold whitespace-nowrap',
        pill,
        className,
      )}
    >
      <span aria-hidden="true" className={cx('size-1.5 rounded-pill', dot)} />
      {DOCUMENTATION_STATUS_LABEL[status]}
    </span>
  );
}
