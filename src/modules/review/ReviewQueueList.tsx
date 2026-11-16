// ReviewQueueList: the "Waiting" card of S-36, the screens In review as a list of buttons, the one waiting longest first.
// Props: rows (ScreenSummary), total, selectedId, onSelect(id), hasMore / loadingMore / moreFailed / onLoadMore ("Load more"
// reads the next page), now (the clock the relative times are measured against).
// Each row: the name in IBM Plex Mono, "Author: <name> · In review since <relative time>" (the exact date and time of
// `updatedAt` is the title of the time; a screen in review cannot be edited, D-53, so `updatedAt` is when it went into
// review) and the number of comments. A labelled list; the selected row has aria-current. The count under the list says how
// many of how many are shown.
import { Button, cx } from '../../components/ui';
import type { ScreenSummary } from '../screens/screenTypes';
import { formatTimestamp } from '../variables/variableLabels';

import { relativeTime } from './reviewModel';
import { LOAD_MORE_LABEL, QUEUE_LABEL } from './reviewTexts';

interface ReviewQueueListProps {
  rows: readonly ScreenSummary[];
  total: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  hasMore: boolean;
  loadingMore: boolean;
  moreFailed: boolean;
  onLoadMore: () => void;
  now: number;
}

export function ReviewQueueList({
  rows,
  total,
  selectedId,
  onSelect,
  hasMore,
  loadingMore,
  moreFailed,
  onLoadMore,
  now,
}: ReviewQueueListProps) {
  return (
    <>
      <ul aria-label={QUEUE_LABEL} className="flex flex-col">
        {rows.map((row) => {
          const selected = row.id === selectedId;
          const ago = relativeTime(row.updatedAt, now);
          return (
            <li key={row.id} className="border-b border-divider last:border-b-0">
              <button
                type="button"
                aria-current={selected ? 'true' : undefined}
                onClick={() => {
                  onSelect(row.id);
                }}
                className={cx(
                  'flex w-full flex-col gap-1 border-l-3 px-5 py-3 text-left transition-colors duration-150 motion-reduce:transition-none',
                  selected
                    ? 'border-accent bg-accent-soft'
                    : 'border-transparent hover:bg-control-hover',
                )}
              >
                <span className="font-mono text-body-lg font-bold break-all text-ink-900">
                  {row.name}
                </span>
                <span className="text-small text-ink-500">
                  Author: {row.author.name} · In review since{' '}
                  <time dateTime={row.updatedAt} title={formatTimestamp(row.updatedAt)}>
                    {ago}
                  </time>
                </span>
                <span className="text-small font-semibold text-ink-700">
                  {row.commentCount} {row.commentCount === 1 ? 'comment' : 'comments'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {(hasMore || rows.length < total) && (
        <div className="flex flex-col items-center gap-1.5 border-t border-divider px-5 py-3">
          <Button loading={loadingMore} onClick={onLoadMore} aria-describedby="review-shown-count">
            {LOAD_MORE_LABEL}
          </Button>
          <span id="review-shown-count" className="text-small text-ink-500">
            Showing {rows.length} of {total}
          </span>
          {moreFailed && (
            <p role="alert" className="text-small text-danger">
              The next screens couldn&apos;t be loaded. Try again.
            </p>
          )}
        </div>
      )}
    </>
  );
}
