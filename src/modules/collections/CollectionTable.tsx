// CollectionTable: the table of the collection list (S-14, S-14 for the Reader without actions).
// Props: rows (CollectionSummary[]), sort (current `sort`), onSort(next), loading (rows are being replaced),
// showSkeleton (draw placeholder rows instead of the rows), renderActions (optional: the content of the last
// column for a row; omitted for the Reader, who sees no actions).
// Columns: Name, Environments, Fields (`fieldCount`, in a small royal-blue pill), Linked to screens (`documented`: "Yes"
// in a green pill with a check, or the "Not linked" tag), Updated. Name and Updated are sortable (the columns of the
// contract whitelist). Identifiers are in IBM Plex Mono. The row under the pointer gets a royal-blue edge on its left.
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import {
  ElementTypeIcon,
  ICON_STROKE_WIDTH,
  Skeleton,
  SortableHeader,
  Tag,
  cx,
} from '../../components/ui';
import { ENVIRONMENTS, formatTimestamp } from '../variables/variableLabels';

import type { CollectionSummary } from './collectionTypes';

interface CollectionTableProps {
  rows: readonly CollectionSummary[];
  sort: string;
  onSort: (next: string) => void;
  loading: boolean;
  showSkeleton: boolean;
  renderActions?: (row: CollectionSummary) => ReactNode;
}

const HEAD_CLASS =
  'px-3 py-3 text-left text-micro font-bold tracking-wider text-collection-ink uppercase';
const SKELETON_ROWS = 5;

export function CollectionTable({
  rows,
  sort,
  onSort,
  loading,
  showSkeleton,
  renderActions,
}: CollectionTableProps) {
  const hasActions = renderActions !== undefined;
  return (
    <div className="overflow-x-auto border-t border-border-subtle">
      <table aria-label="Collections" aria-busy={loading} className="w-full text-left">
        <thead className="bg-collection-soft/70">
          <tr>
            <SortableHeader
              label="Name"
              sortKey="name"
              sort={sort}
              onSort={onSort}
              className="py-3 pl-5 text-collection-ink"
            />
            <th scope="col" className={HEAD_CLASS}>
              Environments
            </th>
            <th scope="col" className={cx(HEAD_CLASS, 'text-center')}>
              Fields
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Linked to screens
            </th>
            <SortableHeader
              label="Updated"
              sortKey="updatedAt"
              sort={sort}
              onSort={onSort}
              className="py-3 text-collection-ink"
            />
            {hasActions && (
              <th scope="col" className={cx(HEAD_CLASS, 'pr-8')}>
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
                    <Skeleton className="h-5 w-20" />
                  </td>
                  <td className="px-3 py-3.5">
                    <Skeleton className="mx-auto h-5 w-10" />
                  </td>
                  <td className="px-3 py-3.5">
                    <Skeleton className="h-4 w-16" />
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
                  className="border-t border-divider transition-[background-color,box-shadow] duration-150 hover:bg-collection-soft/40 hover:shadow-[inset_3px_0_0_var(--color-collection)] motion-reduce:transition-none"
                >
                  <td className="py-3 pr-3 pl-5">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-control bg-collection-soft text-collection-ink"
                      >
                        <ElementTypeIcon type="collection" />
                      </span>
                      <Link
                        to={`/collections/${row.id}`}
                        className="truncate rounded-chip font-mono text-label font-semibold text-identifier hover:underline"
                      >
                        {row.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex gap-1">
                      {ENVIRONMENTS.map((environment) =>
                        row.environments.includes(environment) ? (
                          <Tag
                            key={environment}
                            tone={environment === 'PROD' ? 'success' : 'neutral'}
                          >
                            {environment}
                          </Tag>
                        ) : null,
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-flex min-w-9 justify-center rounded-pill bg-collection-soft px-2.5 py-0.5 text-label font-bold text-collection-ink tabular-nums">
                      {row.fieldCount}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-label text-ink-900">
                    {row.documented ? (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-success-pill-bg px-2 py-0.5 font-semibold text-success-pill-ink">
                        <Check aria-hidden="true" size={13} strokeWidth={ICON_STROKE_WIDTH + 0.5} />
                        Yes
                      </span>
                    ) : (
                      <Tag tone="warning">Not linked</Tag>
                    )}
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
