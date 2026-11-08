// JiraStatusPill: the Jira status pill of the top bar (S-31). No props; it shows the last known availability of Jira
// (useJiraStatus, D-100): "Jira connected" (green, the frame), "Jira unavailable" (warning tokens) and "Jira not checked"
// (neutral, before anything is known). The last two are not drawn in the frames (DESIGN_REFERENCE §9).
// It is plain text with a decorative dot, not a live region: the pages that learn the change say it themselves.
import { cx } from '../components/ui';

import { JIRA_PILL_TEXT, useJiraStatus, type JiraStatus } from './jiraStatusContext';

const PILL_CLASS: Record<JiraStatus, string> = {
  available: 'bg-success-pill-bg text-success-pill-ink',
  unavailable: 'border border-warning-border bg-warning-bg text-warning-ink',
  unknown: 'bg-disabled-bg text-ink-700',
};

const DOT_CLASS: Record<JiraStatus, string> = {
  available: 'bg-success shadow-success-dot',
  unavailable: 'bg-badge-warning-bg',
  unknown: 'bg-ink-500',
};

export function JiraStatusPill() {
  const { status } = useJiraStatus();
  return (
    <span
      data-jira-status={status}
      className={cx(
        'flex items-center gap-1.75 rounded-pill px-2.75 py-1.5 text-small/5 font-semibold whitespace-nowrap',
        PILL_CLASS[status],
      )}
    >
      <span aria-hidden="true" className={cx('size-1.75 rounded-pill', DOT_CLASS[status])} />
      {JIRA_PILL_TEXT[status]}
    </span>
  );
}
