// AuditValue: one stored value of a record, always drawn as TEXT (never as HTML or Markdown: React escapes it, so
// "<b>x</b> & y" is seen literally), written the way a person would say it (auditFormat): yes / no, dates with the hour,
// "In review" for IN_REVIEW.
// Props: value (anything the API sends in `oldValue` / `newValue`), tone ('plain' | 'before' | 'after': the old value is
// struck through, S-32), timeZone (the zone dates are written in; default the browser's).
// null (and an empty text) is "—". A list of simple values is one line ("a, b, c"); an object (a JSONB column such as a
// report's parameters) or a list of objects is a small list of "Name: value" lines, nested ones included, with the names
// written as in the field column. A text longer than LIMIT characters is cut with "…" and a "Show more" button
// (aria-expanded) that shows all of it, "Show less" cuts it again.
import { useId, useState } from 'react';
import type { ReactNode } from 'react';

import { cx } from '../../components/ui';

import { browserTimeZone } from './auditDates';
import { humanKey, humanValue } from './auditFormat';

/** Characters shown before "Show more". */
export const VALUE_LIMIT = 200;
const EMPTY = '—';

const isEmpty = (value: unknown) => value === null || value === undefined || value === '';
const isSimple = (value: unknown) => typeof value !== 'object' || value === null;

interface AuditValueProps {
  value: unknown;
  tone?: 'plain' | 'before' | 'after';
  timeZone?: string;
}

function Simple({ value, timeZone }: { value: unknown; timeZone: string }) {
  return <>{isEmpty(value) ? EMPTY : humanValue(value, timeZone)}</>;
}

/** An object or a list of objects as lines of "Name: value". */
function Structured({ value, timeZone }: { value: unknown; timeZone: string }): ReactNode {
  if (Array.isArray(value)) {
    const list: unknown[] = value;
    if (list.length === 0) return <span>{EMPTY}</span>;
    if (list.every(isSimple)) {
      return (
        <span>
          {list.map((item) => (isEmpty(item) ? EMPTY : humanValue(item, timeZone))).join(', ')}
        </span>
      );
    }
    return (
      <ol className="flex flex-col gap-1.5">
        {list.map((item, index) => (
          <li key={index} className="rounded-chip bg-surface/70 px-2.5 py-1.5">
            {isSimple(item) ? (
              <Simple value={item} timeZone={timeZone} />
            ) : (
              <Structured value={item} timeZone={timeZone} />
            )}
          </li>
        ))}
      </ol>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return <span>{EMPTY}</span>;
  return (
    <dl className="flex flex-col gap-0.5">
      {entries.map(([key, item]) => (
        <div key={key} className="flex flex-wrap gap-x-1.5">
          <dt className="font-semibold text-ink-700">{humanKey(key)}:</dt>
          <dd className="min-w-0 break-words">
            {isSimple(item) ? (
              <Simple value={item} timeZone={timeZone} />
            ) : (
              <Structured value={item} timeZone={timeZone} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AuditValue({ value, tone = 'plain', timeZone }: AuditValueProps) {
  const [expanded, setExpanded] = useState(false);
  const textId = useId();
  const zone = timeZone ?? browserTimeZone();

  if (isEmpty(value)) {
    return <span title="Empty">{EMPTY}</span>;
  }
  const toneClass = cx(
    tone === 'before' && 'text-danger line-through',
    tone === 'after' && 'text-success-ink',
  );
  if (!isSimple(value)) {
    return (
      <div id={textId} className={cx('min-w-0 text-small', toneClass)}>
        <Structured value={value} timeZone={zone} />
      </div>
    );
  }
  const text = humanValue(value, zone);
  const long = text.length > VALUE_LIMIT;
  const shown = long && !expanded ? `${text.slice(0, VALUE_LIMIT)}…` : text;

  return (
    <div className="min-w-0">
      <span id={textId} className={cx('block break-words whitespace-pre-wrap', toneClass)}>
        {shown}
      </span>
      {long && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={textId}
          onClick={() => {
            setExpanded(!expanded);
          }}
          className="mt-1 rounded-chip text-small font-semibold text-primary hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
