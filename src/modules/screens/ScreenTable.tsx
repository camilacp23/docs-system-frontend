// ScreenTable: the table of the screen list (S-18; the Reader gets no actions column).
// Props: rows (ScreenSummary[]), sort (current `sort`), onSort(next), loading (rows are being replaced),
// showSkeleton (draw placeholder rows instead of the rows), renderActions (optional: the content of the last
// column for a row; omitted for the Reader, who sees no actions).
// Columns: Name (with the "Reserved" tag for App (OnStart)), Status, Author, Pending to-dos (`pendingSubtasks`,
// "—" when none), Comments, Updated. Name, Status, Pending to-dos and Updated are sortable (the contract whitelist).
// Screen names are Power Apps identifiers: IBM Plex Mono.
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { ElementTypeIcon, Skeleton, SortableHeader, StatusTag, Tag, cx } from '../../components/ui';
import { formatTimestamp } from '../variables/variableLabels';

import { RESERVED_LABEL, toTagStatus } from './screenLabels';
import type { ScreenSummary } from './screenTypes';

interface ScreenTableProps {
  rows: readonly ScreenSummary[];
  sort: string;
  onSort: (next: string) => void;
  loading: boolean;
  showSkeleton: boolean;
  renderActions?: (row: ScreenSummary) => ReactNode;
}

const HEAD_CLASS =
  'px-3 py-3 text-left text-micro font-bold tracking-wider text-screen-ink uppercase';
const SKELETON_ROWS = 5;

export function ScreenTable({
  rows,
  sort,
  onSort,
  loading,
  showSkeleton,
  renderActions,
}: ScreenTableProps) {
  const hasActions = renderActions !== undefined;
  return (
    <div className="overflow-x-auto border-t border-border-subtle">
      <table aria-label="Screens" aria-busy={loading} className="w-full text-left">
        <thead className="bg-screen-soft/70">
          <tr>
            <SortableHeader
              label="Name"
              sortKey="name"
              sort={sort}
              onSort={onSort}
              className="py-3 pl-5 text-screen-ink"
            />
            <SortableHeader
              label="Status"
              sortKey="documentationStatus"
              sort={sort}
              onSort={onSort}
              className="py-3 text-screen-ink"
            />
            <th scope="col" className={HEAD_CLASS}>
              Author
            </th>
            <SortableHeader
              label="Pending to-dos"
              sortKey="pendingSubtasks"
              sort={sort}
              onSort={onSort}
              className="py-3 text-screen-ink"
            />
            <th scope="col" className={`${HEAD_CLASS} text-right`}>
              Comments
            </th>
            <SortableHeader
              label="Updated"
              sortKey="updatedAt"
              sort={sort}
              onSort={onSort}
              className="py-3 text-screen-ink"
            />
            {hasActions && (
              <th scope="col" className={`${HEAD_CLASS} pr-8`}>
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className={cx(loading && !showSkeleton && 'opacity-60')}>
          {showSkeleton
            ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <tr key={index} aria-hidden="true" className="border-t border-divider">
                  <td className="py-3.5 pr-3 pl-5">
                    <Skeleton className="h-8 w-48" />
                  </td>
                  <td className="px-3 py-3.5">
                    <Skeleton className="h-5 w-24" />
                  </td>
                  <td className="px-3 py-3.5">
                    <Skeleton className="h-4 w-28" />
                  </td>
                  <td className="px-3 py-3.5">
                    <Skeleton className="ml-auto h-4 w-8" />
                  </td>
                  <td className="px-3 py-3.5">
                    <Skeleton className="ml-auto h-4 w-8" />
                  </td>
                  <td className="px-3 py-3.5">
                    <Skeleton className="h-4 w-32" />
                  </td>
                  {hasActions && (
                    <td className="py-3.5 pr-8 pl-3">
                      <Skeleton className="size-7.5" />
                    </td>
                  )}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-divider transition-colors duration-150 hover:bg-screen-soft/40 motion-reduce:transition-none"
                >
                  <td className="py-3 pr-3 pl-5">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-control bg-screen-soft text-screen-ink"
                      >
                        <ElementTypeIcon type="screen" />
                      </span>
                      <Link
                        to={`/screens/${row.id}`}
                        className="truncate rounded-chip font-mono text-label font-semibold text-identifier hover:underline"
                      >
                        {row.name}
                      </Link>
                      {row.isAppContext && <Tag>{RESERVED_LABEL}</Tag>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <StatusTag status={toTagStatus(row.documentationStatus)} />
                  </td>
                  <td className="px-3 py-3 text-label text-ink-900">{row.author.name}</td>
                  <td className="px-3 py-3 text-right text-label text-ink-900 tabular-nums">
                    {row.pendingSubtasks > 0 ? row.pendingSubtasks : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-label text-ink-900 tabular-nums">
                    {row.commentCount}
                  </td>
                  <td className="px-3 py-3 text-label whitespace-nowrap text-ink-700">
                    {formatTimestamp(row.updatedAt)}
                  </td>
                  {hasActions && (
                    <td className="py-3 pr-8 pl-3 text-right">{renderActions(row)}</td>
                  )}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
