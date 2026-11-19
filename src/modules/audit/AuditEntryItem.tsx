// AuditEntryItem: one record of the timeline (S-32, S-32d): the time, an icon and color per action, the sentence
// "<actor> <action> <type> <label>" and, for an UPDATE, a chip for each field that changed.
// Props: entry (AuditEntry), timeZone (IANA zone the time is drawn in), ownView (a Developer's view: their own
// records say "You", S-32d).
// The label of the element is a link when its type has a page (screens, variables, collections: a deleted one opens
// that page's own "doesn't exist"), plain text otherwise. The actor is null for a write that did not come through
// the API ("Outside the application", with the database role of the write for an Administrator, S-32).
// The whole row (or the chevron button, which keeps the keyboard and screen reader use) opens the record's detail (AuditEntryDetail) under it: it has aria-expanded and aria-controls and
// works with Enter and Space (it is a native button). Each record keeps its own open / closed state.
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router';

import { cx, ICON_STROKE_WIDTH } from '../../components/ui';

import { AuditActionIcon } from './AuditActionIcon';
import { AuditEntryDetail } from './AuditEntryDetail';
import { clockOf } from './auditDates';
import {
  ACTION_TONE,
  actionPhrase,
  actorText,
  elementLabel,
  elementPath,
  fieldLabel,
} from './auditLabels';
import type { AuditEntry } from './auditLabels';

const MONO_CLASS = 'font-mono text-label font-semibold text-identifier';

interface AuditEntryItemProps {
  entry: AuditEntry;
  timeZone: string;
  ownView: boolean;
}

export function AuditEntryItem({ entry, timeZone, ownView }: AuditEntryItemProps) {
  const path = elementPath(entry);
  const label = elementLabel(entry);
  const changed = entry.action === 'UPDATE' ? entry.changedFields : [];
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const sentence = `${actorText(entry, ownView)} ${actionPhrase(entry)} ${label}`;

  return (
    <li className="group px-2">
      <div
        // The whole row opens the record, not only the chevron (which stays the button for the keyboard and screen readers). A click
        // on a link, a button or inside the open detail does what it says and does not toggle.
        role="presentation"
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('a, button, input, select, textarea') !== null) return;
          if (target.closest('[data-audit-detail]') !== null) return;
          setOpen(!open);
        }}
        className="relative flex cursor-pointer gap-4 rounded-card px-3 transition-colors duration-150 after:absolute after:right-3 after:bottom-0 after:left-[4.75rem] after:h-px after:bg-linear-to-r after:from-audit-border after:to-transparent after:content-[''] group-last:after:hidden hover:bg-audit-soft/50 motion-reduce:transition-none"
      >
        <time
          dateTime={entry.createdAt}
          className="w-12 shrink-0 pt-4.5 font-mono text-small font-semibold text-ink-700"
        >
          {clockOf(entry.createdAt, timeZone)}
        </time>
        <div className="flex shrink-0 flex-col items-center pt-3">
          <span
            aria-hidden="true"
            className={cx(
              'flex size-9 items-center justify-center rounded-pill',
              ACTION_TONE[entry.action],
            )}
          >
            <AuditActionIcon action={entry.action} />
          </span>
        </div>
        <div className="min-w-0 flex-1 pt-3.5 pb-5">
          <p className="text-body-lg break-words text-ink-900">
            <span className="font-semibold">{actorText(entry, ownView)}</span>
            {entry.actor === null && entry.dbRole !== undefined && (
              <span className="text-small text-ink-500"> ({entry.dbRole})</span>
            )}{' '}
            {actionPhrase(entry)}{' '}
            {path === null ? (
              <span className={MONO_CLASS}>{label}</span>
            ) : (
              <Link to={path} className={`${MONO_CLASS} rounded-chip hover:underline`}>
                {label}
              </Link>
            )}
          </p>
          {changed.length > 0 && (
            <ul aria-label="Changed fields" className="mt-1.5 flex flex-wrap gap-1.5">
              {changed.map((key) => (
                <li
                  key={key}
                  className="rounded-pill border border-audit-border bg-audit-soft px-2.5 py-0.5 text-micro font-semibold text-audit-ink"
                >
                  {fieldLabel(key)}
                </li>
              ))}
            </ul>
          )}
          {open && (
            <div id={detailId} data-audit-detail="" className="cursor-auto">
              <AuditEntryDetail entry={entry} />
            </div>
          )}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? detailId : undefined}
          aria-label={`Details of ${sentence}`}
          onClick={() => {
            setOpen(!open);
          }}
          className="mt-3.5 flex size-8 shrink-0 items-center justify-center self-start rounded-control text-ink-500 transition-colors duration-150 hover:bg-audit-soft hover:text-audit-ink aria-expanded:bg-audit-soft aria-expanded:text-audit-ink motion-reduce:transition-none"
        >
          {open ? (
            <ChevronDown aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
          ) : (
            <ChevronRight aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
          )}
        </button>
      </div>
    </li>
  );
}
