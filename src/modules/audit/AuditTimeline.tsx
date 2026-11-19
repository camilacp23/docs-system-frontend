// AuditTimeline: the records of one page grouped by local day (S-32): a heading for each day ("Today · Oct 5") and an
// ordered list of records under it, newest first as the API sends them.
// Props: entries (AuditEntry[] in API order), timeZone, today (local day), ownView, loading (the page is being
// replaced), showSkeleton (draw placeholder rows).
// The days are headings (h2) and each day's records an ordered list named by its heading, so a screen reader can walk
// the days and the records.
import { useId } from 'react';

import { Skeleton } from '../../components/ui';

import { AuditEntryItem } from './AuditEntryItem';
import { dayHeading, dayOf } from './auditDates';
import type { AuditEntry } from './auditLabels';

interface AuditTimelineProps {
  entries: readonly AuditEntry[];
  timeZone: string;
  today: string;
  ownView: boolean;
  loading: boolean;
  showSkeleton: boolean;
}

const SKELETON_ROWS = 4;

interface DayGroup {
  day: string;
  entries: AuditEntry[];
}

/** Consecutive records of the same local day; the API order is kept, so the days come newest first. */
function groupByDay(entries: readonly AuditEntry[], timeZone: string): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const day = dayOf(entry.createdAt, timeZone);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.entries.push(entry);
    else groups.push({ day, entries: [entry] });
  }
  return groups;
}

export function AuditTimeline({
  entries,
  timeZone,
  today,
  ownView,
  loading,
  showSkeleton,
}: AuditTimelineProps) {
  const ids = useId();

  if (showSkeleton) {
    return (
      <div aria-hidden="true" className="flex flex-col gap-5 px-5 py-6">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="size-9 rounded-pill" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div aria-busy={loading}>
      {groupByDay(entries, timeZone).map((group) => {
        const headingId = `${ids}-${group.day}`;
        return (
          <section key={group.day} aria-labelledby={headingId}>
            <h2
              id={headingId}
              className="mx-5 mt-5 mb-1 w-fit rounded-pill bg-audit-soft px-3 py-1 text-micro font-bold tracking-wider text-audit-ink uppercase"
            >
              {dayHeading(group.day, today)}
            </h2>
            <ol aria-labelledby={headingId}>
              {group.entries.map((entry) => (
                <AuditEntryItem
                  key={entry.id}
                  entry={entry}
                  timeZone={timeZone}
                  ownView={ownView}
                />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
