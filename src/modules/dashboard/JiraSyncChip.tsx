// JiraSyncChip: when the local copy of the Jira to-dos was last synchronized, as a solid purple chip (a clock and the
// date, or "Never synced"). It sits in the header of the "Pending to-dos by screen" card, so the figure cards keep the
// same height. Props: lastSyncedAt (ISO or null), timeZone. "Last synced" is said to screen readers before the date.
import { Clock } from 'lucide-react';

import { ICON_STROKE_WIDTH } from '../../components/ui';

import { syncedText } from './dashboardModel';
import { LAST_SYNCED_LABEL, NEVER_SYNCED } from './dashboardTexts';

export function JiraSyncChip({
  lastSyncedAt,
  timeZone,
}: {
  lastSyncedAt: string | null;
  timeZone: string;
}) {
  const synced = syncedText(lastSyncedAt, timeZone);
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-pill bg-jira px-2 py-0.75 text-micro font-bold whitespace-nowrap text-on-primary">
      <Clock size={12} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" className="shrink-0" />
      {synced === null || lastSyncedAt === null ? (
        NEVER_SYNCED
      ) : (
        <>
          <span className="sr-only">{LAST_SYNCED_LABEL} </span>
          <time dateTime={lastSyncedAt}>{synced}</time>
        </>
      )}
    </span>
  );
}
