// AuditEntryItem: one record of the timeline (S-32, S-32d): the time, an icon and color per action, the sentence
// "<actor> <action> <type> <label>" and, for an UPDATE, a chip for each field that changed.
// Props: entry (AuditEntry), timeZone (IANA zone the time is drawn in), ownView (a Developer's view: their own
// records say "You", S-32d).
// The label of the element is a link when its type has a page (screens, variables, collections: a deleted one opens
// that page's own "doesn't exist"), plain text otherwise. The actor is null for a write that did not come through
// the API ("Outside the application", with the database role of the write for an Administrator, S-32).
import { CircleCheck, Pencil, Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { cx, ICON_STROKE_WIDTH } from '../../components/ui';

import { clockOf } from './auditDates';
import {
  ACTION_TONE,
  actionPhrase,
  actorText,
  elementLabel,
  elementPath,
  fieldLabel,
} from './auditLabels';
import type { AuditAction, AuditEntry } from './auditLabels';

const ICON = { size: 18, strokeWidth: ICON_STROKE_WIDTH, 'aria-hidden': true } as const;

const ACTION_ICON: Record<AuditAction, ReactNode> = {
  CREATE: <Plus {...ICON} />,
  UPDATE: <Pencil {...ICON} />,
  DELETE: <X {...ICON} />,
  EVENT: <CircleCheck {...ICON} />,
};

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

  return (
    <li className="group flex gap-4 px-5">
      <time
        dateTime={entry.createdAt}
        className="w-12 shrink-0 pt-4.5 font-mono text-small text-ink-500"
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
          {ACTION_ICON[entry.action]}
        </span>
        <span aria-hidden="true" className="mt-1 w-0.5 flex-1 bg-border-subtle group-last:hidden" />
      </div>
      <div className="min-w-0 flex-1 py-3.5">
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
                className="rounded-chip border border-border-subtle bg-search-bg px-2 py-0.5 font-mono text-micro text-ink-700"
              >
                {fieldLabel(key)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
