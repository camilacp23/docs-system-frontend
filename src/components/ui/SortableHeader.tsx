// SortableHeader: a <th> of a sortable list column (S-10). Props: label, sortKey (the API `sort` value of this
// column), sort (the current `sort` value, "name" or "-name"), onSort(next) with the next value (ascending
// first, then toggles). The button states the action for assistive technology; aria-sort tells the state.
import { ArrowDown, ArrowUp } from 'lucide-react';

import { cx, ICON_STROKE_WIDTH } from './cx';
import { nextSort } from './sort';

export interface SortableHeaderProps {
  label: string;
  sortKey: string;
  sort: string;
  onSort: (next: string) => void;
  /** Overrides of the cell (the first column of a table with a wider edge padding). */
  className?: string;
}

export function SortableHeader({ label, sortKey, sort, onSort, className }: SortableHeaderProps) {
  const ascending = sort === sortKey;
  const descending = sort === `-${sortKey}`;
  const Arrow = descending ? ArrowDown : ArrowUp;
  return (
    <th
      scope="col"
      aria-sort={ascending ? 'ascending' : descending ? 'descending' : 'none'}
      className={cx(
        'px-3 py-2.5 text-left text-micro font-bold tracking-wider text-ink-500 uppercase',
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Sort by ${label}`}
        onClick={() => {
          onSort(nextSort(sort, sortKey));
        }}
        className="inline-flex items-center gap-1 rounded-chip uppercase"
      >
        {label}
        {(ascending || descending) && (
          <Arrow aria-hidden="true" size={12} strokeWidth={ICON_STROKE_WIDTH + 0.5} />
        )}
      </button>
    </th>
  );
}
