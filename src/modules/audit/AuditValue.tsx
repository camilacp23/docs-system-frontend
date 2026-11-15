// AuditValue: one stored value of a record, always drawn as TEXT (never as HTML or Markdown: React escapes it, so
// "<b>x</b> & y" is seen literally).
// Props: value (anything the API sends in `oldValue` / `newValue`), tone ('plain' | 'before' | 'after': the old value is
// struck through, S-32).
// null (and an empty text) is "—". Objects and arrays (a JSONB column such as a report's parameters) are shown
// formatted and legible, as indented JSON in IBM Plex Mono. A value longer than LIMIT characters is cut with "…" and a
// "Show more" button (aria-expanded) that shows all of it, "Show less" cuts it again.
import { useId, useState } from 'react';

import { cx } from '../../components/ui';

/** Characters shown before "Show more". */
export const VALUE_LIMIT = 200;
const EMPTY = '—';

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value, null, 2);
  return String(value);
}

interface AuditValueProps {
  value: unknown;
  tone?: 'plain' | 'before' | 'after';
}

export function AuditValue({ value, tone = 'plain' }: AuditValueProps) {
  const [expanded, setExpanded] = useState(false);
  const textId = useId();

  if (value === null || value === undefined || value === '') {
    return <span title="Empty">{EMPTY}</span>;
  }
  const text = textOf(value);
  const structured = typeof value === 'object';
  const long = text.length > VALUE_LIMIT;
  const shown = long && !expanded ? `${text.slice(0, VALUE_LIMIT)}…` : text;
  const Body = structured ? 'pre' : 'span';

  return (
    <div className="min-w-0">
      <Body
        id={textId}
        className={cx(
          'block break-words whitespace-pre-wrap',
          structured && 'font-mono text-small',
          tone === 'before' && 'text-danger line-through',
          tone === 'after' && 'text-success-ink',
        )}
      >
        {shown}
      </Body>
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
