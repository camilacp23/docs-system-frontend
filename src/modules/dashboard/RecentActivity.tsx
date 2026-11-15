// RecentActivity: the body of the "Recent activity" card (S-31): the 10 most recent audit records of the application, of
// the whole team, newest first. Props: entries (ActivitySummary[] as the API sends them), timeZone.
// Each row says the same sentence as the audit timeline (the helpers of auditLabels: "<actor> <action> <type> <label>"),
// with the label in IBM Plex Mono, a link to its page when the type has one, and under it "<Type> · <time>" in the local
// time of the browser; a record of another day says the day too ("Screen · Oct 4, 10:21"). The API sends no values, so
// there is nothing else to show. A null actor is a write outside the API ("Outside the application"). The color of the
// dot at the right is the one of the action in the audit log (created, updated, deleted, event); the sentence says the
// action, so the dot is decoration.
// The Reader never gets this card: the API does not send the key (D-34) and DashboardView does not draw it.
import { Database } from 'lucide-react';
import { Link } from 'react-router';

import { Avatar, cx, ICON_STROKE_WIDTH } from '../../components/ui';
import {
  actionPhrase,
  actorText,
  ENTITY_TYPE_LABEL,
  elementLabel,
  elementPath,
  type AuditAction,
} from '../audit/auditLabels';
import { todayIn } from '../audit/auditDates';

import { activityTime, type ActivitySummary } from './dashboardModel';

export const NO_ACTIVITY_TEXT = 'No recent activity yet.';

const DOT_CLASS: Record<AuditAction, string> = {
  CREATE: 'bg-success',
  UPDATE: 'bg-accent',
  DELETE: 'bg-danger',
  EVENT: 'bg-ink-500',
};

const MONO_CLASS = 'font-mono text-label font-semibold text-identifier';

interface RecentActivityProps {
  entries: readonly ActivitySummary[];
  timeZone: string;
}

export function RecentActivity({ entries, timeZone }: RecentActivityProps) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-body text-ink-500">{NO_ACTIVITY_TEXT}</p>;
  }
  const today = todayIn(timeZone);
  return (
    <ul>
      {entries.map((entry, index) => {
        const path = elementPath(entry);
        const label = elementLabel(entry);
        return (
          <li
            key={`${entry.createdAt}-${entry.entityType}-${entry.entityId}-${index}`}
            className="flex items-center gap-3 border-b border-divider py-2.5 last:border-b-0"
          >
            {entry.actor === null ? (
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-disabled-bg text-ink-700"
              >
                <Database size={16} strokeWidth={ICON_STROKE_WIDTH} />
              </span>
            ) : (
              <Avatar name={entry.actor.name} decorative className="size-8" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-label break-words text-ink-900">
                <span className="font-bold">{actorText(entry, false)}</span> {actionPhrase(entry)}{' '}
                {path === null ? (
                  <span className={MONO_CLASS}>{label}</span>
                ) : (
                  <Link to={path} className={cx(MONO_CLASS, 'rounded-chip hover:underline')}>
                    {label}
                  </Link>
                )}
              </p>
              <p className="text-small text-ink-500">
                {ENTITY_TYPE_LABEL[entry.entityType]} ·{' '}
                <time dateTime={entry.createdAt}>
                  {activityTime(entry.createdAt, timeZone, today)}
                </time>
              </p>
            </div>
            <span
              aria-hidden="true"
              className={cx('size-2 shrink-0 rounded-chip', DOT_CLASS[entry.action])}
            />
          </li>
        );
      })}
    </ul>
  );
}
