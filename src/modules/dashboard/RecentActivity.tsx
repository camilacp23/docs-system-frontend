// RecentActivity: the body of the "Recent activity" card (S-31): the 10 most recent audit records of the application, of
// the whole team, newest first. Props: entries (ActivitySummary[] as the API sends them), timeZone.
// Each row says the same sentence as the audit timeline (the helpers of auditLabels: "<actor> <action> <type> <label>"),
// with the label in IBM Plex Mono, a link to its page when the type has one, and under it "<Type> · <time>" in the local
// time of the browser; a record of another day says the day too ("Screen · Oct 4, 10:21"). The API sends no values, so
// there is nothing else to show. A null actor is a write outside the API ("Outside the application"). The color of the
// round icon at the left is the one of the action in the audit log (a plus for created, a pencil for updated, a trash can for
// deleted, a check circle for events, each in its color); the sentence says the action, so the icon is decoration.
// On a wide page (container of 900 px or more) the card spans the page and the rows are in two columns.
// The Reader never gets this card: the API does not send the key (D-34) and DashboardView does not draw it.
import { Link } from 'react-router';

import { cx } from '../../components/ui';
import { AuditActionIcon } from '../audit/AuditActionIcon';
import {
  ACTION_TONE,
  actionPhrase,
  actorText,
  ENTITY_TYPE_LABEL,
  elementLabel,
  elementPath,
} from '../audit/auditLabels';
import { todayIn } from '../audit/auditDates';

import { activityTime, type ActivitySummary } from './dashboardModel';

export const NO_ACTIVITY_TEXT = 'No recent activity yet.';

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
    <ul className="grid @min-[900px]:grid-cols-2 @min-[900px]:gap-x-6">
      {entries.map((entry, index) => {
        const path = elementPath(entry);
        const label = elementLabel(entry);
        return (
          <li
            key={`${entry.createdAt}-${entry.entityType}-${entry.entityId}-${index}`}
            className="flex items-center gap-3 border-b border-divider py-2.5 last:border-b-0 @min-[900px]:rounded-control @min-[900px]:border-b-0 @min-[900px]:px-2 @min-[900px]:hover:bg-control-hover"
          >
            <span
              aria-hidden="true"
              className={cx(
                'flex size-8 shrink-0 items-center justify-center rounded-pill',
                ACTION_TONE[entry.action],
              )}
            >
              <AuditActionIcon action={entry.action} size={16} />
            </span>
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
          </li>
        );
      })}
    </ul>
  );
}
