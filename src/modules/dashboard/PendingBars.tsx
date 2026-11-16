// PendingBars: "Pending to-dos by screen" (S-31): one horizontal bar per screen with pending to-dos, the most first.
// Props: rows (TopScreen[], at most five, all above 0). With no rows the sentence "No pending to-dos" takes its place.
// Drawing: the names and the values are an HTML list (every row has a fixed height); the bars are ONE SVG laid over the
// middle column, role="img" with the figures of every row in its aria-label, so the list is the text alternative and
// each name is a link to the To-do tab of its screen (the accessible name adds the count: "Detalle, 3 pending to-dos").
// Length is relative to the longest bar. The bar goes from `primary` to `accent` over a track (frame S-31): both read
// 3:1 or more against the track. The entrance (fade) is skipped under prefers-reduced-motion.
import { useId } from 'react';
import { Link } from 'react-router';

import { barsSummary, pendingText, todoHref, type TopScreen } from './dashboardModel';

const ROW_HEIGHT = 40;
const BAR_HEIGHT = 12;
export const NO_PENDING_TEXT = 'No pending to-dos';

interface PendingBarsProps {
  rows: readonly TopScreen[];
}

export function PendingBars({ rows }: PendingBarsProps) {
  const gradientId = useId();
  if (rows.length === 0) {
    return <p className="py-6 text-center text-body text-ink-500">{NO_PENDING_TEXT}</p>;
  }
  const longest = Math.max(...rows.map((row) => row.pending));
  return (
    <div className="relative">
      <ul>
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3" style={{ height: ROW_HEIGHT }}>
            <Link
              to={todoHref(row.id)}
              className="w-30 shrink-0 truncate rounded-chip font-mono text-label text-ink-900 hover:underline"
            >
              {row.name}
              <span className="sr-only">, {pendingText(row.pending)}</span>
            </Link>
            <span className="flex-1" aria-hidden="true" />
            <span className="w-6 text-label font-bold text-ink-900 tabular-nums">
              {row.pending}
            </span>
          </li>
        ))}
      </ul>
      <svg
        role="img"
        aria-label={barsSummary(rows)}
        height={rows.length * ROW_HEIGHT}
        className="pointer-events-none absolute top-0 left-33 w-[calc(100%-10.5rem)]"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--color-primary)' }} />
            <stop offset="1" style={{ stopColor: 'var(--color-accent)' }} />
          </linearGradient>
        </defs>
        <g className="motion-safe:animate-fade-in">
          {rows.map((row, index) => {
            const y = index * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
            return (
              <g key={row.id}>
                <rect
                  y={y}
                  width="100%"
                  height={BAR_HEIGHT}
                  rx={BAR_HEIGHT / 2}
                  className="fill-divider"
                />
                <rect
                  y={y}
                  width={`${(row.pending / longest) * 100}%`}
                  height={BAR_HEIGHT}
                  rx={BAR_HEIGHT / 2}
                  fill={`url(#${gradientId})`}
                />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
