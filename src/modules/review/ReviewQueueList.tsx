// ReviewQueueList: the "Waiting" card of S-36, the screens In review as a list of buttons, the one waiting longest first.
// Props: rows (ScreenSummary), total, selectedId, onSelect(id), hasMore / loadingMore / moreFailed / onLoadMore ("Load more"
// reads the next page).
// The card has its own header (a clock tile, "Waiting", "Oldest first" and the total as a pill in the top right corner). Each row is a soft tile: the
// name in IBM Plex Mono, "Author: <name>" (how long it has been in review is in the panel on the right)
// and the number of comments as a small chip. A labelled list; the selected row has aria-current and the color of the
// page. The count under the list says how many of how many are shown.
import { Clock, MessageSquare } from 'lucide-react';

import { Button, cx, ICON_STROKE_WIDTH } from '../../components/ui';
import type { ScreenSummary } from '../screens/screenTypes';

import { LOAD_MORE_LABEL, QUEUE_LABEL, WAITING_TITLE } from './reviewTexts';

interface ReviewQueueListProps {
  rows: readonly ScreenSummary[];
  total: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  hasMore: boolean;
  loadingMore: boolean;
  moreFailed: boolean;
  onLoadMore: () => void;
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
}: ReviewQueueListProps) {
  return (
    <section
      aria-labelledby="review-waiting-title"
      className="flex min-h-0 flex-col overflow-hidden rounded-modal border border-review-border bg-surface shadow-card"
    >
      <header className="relative flex items-center gap-3 border-b border-review-border/60 bg-linear-to-r from-review-soft to-surface px-5 py-4">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-control bg-(image:--gradient-review-blue) text-on-primary shadow-nav-tile"
        >
          <Clock size={17} strokeWidth={ICON_STROKE_WIDTH} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 id="review-waiting-title" className="text-card-title font-bold text-ink-900">
              {WAITING_TITLE}
            </h2>
            <span className="absolute top-3 right-4 rounded-pill bg-review-blue px-2.5 py-0.5 text-tag font-bold text-on-primary shadow-button">
              {total}
            </span>
          </div>
          <p className="text-small text-ink-500">Oldest first</p>
        </div>
      </header>
      <ul aria-label={QUEUE_LABEL} className="flex flex-1 flex-col gap-1.5 p-2.5">
        {rows.map((row) => {
          const selected = row.id === selectedId;
          return (
            <li key={row.id}>
              <button
                type="button"
                aria-current={selected ? 'true' : undefined}
                onClick={() => {
                  onSelect(row.id);
                }}
                className={cx(
                  'flex w-full flex-col gap-0.5 rounded-card border px-3 py-2.5 text-left transition-colors duration-150 motion-reduce:transition-none',
                  selected
                    ? 'border-review-border bg-review-soft shadow-button'
                    : 'border-transparent hover:bg-control-hover',
                )}
              >
                <span className="font-mono text-body-lg font-bold break-all text-ink-900">
                  {row.name}
                </span>
                <span className="text-small text-ink-500">Author: {row.author.name}</span>
                <span
                  className={cx(
                    'mt-1 inline-flex w-fit items-center gap-1 rounded-pill px-2 py-0.5 text-tag font-semibold',
                    selected ? 'bg-surface text-review-ink' : 'bg-disabled-bg text-ink-700',
                  )}
                >
                  <MessageSquare aria-hidden="true" size={12} strokeWidth={ICON_STROKE_WIDTH} />
                  {row.commentCount} {row.commentCount === 1 ? 'comment' : 'comments'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {(hasMore || rows.length < total) && (
        <div className="flex flex-col items-center gap-1.5 border-t border-review-border/60 bg-review-soft/40 px-5 py-3">
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
    </section>
  );
}
