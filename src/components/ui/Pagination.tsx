// Pagination: footer of every list (S-10): "Showing 1–5 of 5", previous / page numbers / next and "Rows per page".
// Props: page (1-based), pageSize, total, pageSizes (default 20, 50, 100), onPageChange(page),
// onPageSizeChange(size), disabled (while a page loads). Page buttons expose aria-current="page"; the range text
// is a polite live region so a screen reader hears the new range after a page change.
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cx, ICON_STROKE_WIDTH } from './cx';
import { PAGE_SIZES, visiblePages } from './pageNumbers';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  pageSizes?: readonly number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  disabled?: boolean;
}

const BUTTON_CLASS =
  'flex size-7.5 items-center justify-center rounded-chip border text-label font-semibold disabled:cursor-not-allowed disabled:opacity-45';

export function Pagination({
  page,
  pageSize,
  total,
  pageSizes = PAGE_SIZES,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const iconProps = { size: 16, strokeWidth: ICON_STROKE_WIDTH, 'aria-hidden': true } as const;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-t border-divider px-4 py-3 text-label text-ink-700">
      <p aria-live="polite">
        Showing {from}–{to} of {total}
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous page"
          disabled={disabled || page <= 1}
          onClick={() => {
            onPageChange(page - 1);
          }}
          className={cx(BUTTON_CLASS, 'border-border-control bg-surface text-ink-900')}
        >
          <ChevronLeft {...iconProps} />
        </button>
        {visiblePages(page, pageCount).map((p, index) =>
          p === null ? (
            <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-ink-500">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              disabled={disabled}
              onClick={() => {
                onPageChange(p);
              }}
              className={cx(
                BUTTON_CLASS,
                p === page
                  ? 'border-navy-900 bg-navy-900 text-on-primary'
                  : 'border-border-control bg-surface text-ink-900',
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Next page"
          disabled={disabled || page >= pageCount}
          onClick={() => {
            onPageChange(page + 1);
          }}
          className={cx(BUTTON_CLASS, 'border-border-control bg-surface text-ink-900')}
        >
          <ChevronRight {...iconProps} />
        </button>
      </nav>
      <label className="flex items-center justify-end gap-2">
        <span>Rows per page</span>
        <select
          value={pageSize}
          disabled={disabled}
          onChange={(event) => {
            onPageSizeChange(Number(event.target.value));
          }}
          className="h-7.5 rounded-chip border border-border-control bg-surface px-2 font-bold text-ink-900 disabled:opacity-45"
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
