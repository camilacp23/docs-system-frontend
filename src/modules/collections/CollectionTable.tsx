// CollectionTable: the table of the collection list (S-14, S-14 for the Reader without actions).
// Props: rows (CollectionSummary[]), sort (current `sort`), onSort(next), loading (rows are being replaced),
// showSkeleton (draw placeholder rows instead of the rows), renderActions (optional: the content of the last
// column for a row; omitted for the Reader, who sees no actions).
// Columns: Name, Environments, Fields (`fieldCount`), Linked to screens (`documented`: "Yes" or the "Not linked"
// tag), Updated. Name and Updated are sortable (the columns of the contract whitelist). Identifiers are in IBM Plex
// Mono.
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { ElementTypeIcon, Skeleton, SortableHeader, Tag, cx } from '../../components/ui';
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
  'px-3 py-2.5 text-left text-micro font-bold tracking-wider text-ink-500 uppercase';
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
        <thead className="bg-search-bg">
          <tr>
            <SortableHeader label="Name" sortKey="name" sort={sort} onSort={onSort} />
            <th scope="col" className={HEAD_CLASS}>
              Environments
            </th>
            <th scope="col" className={`${HEAD_CLASS} text-right`}>
              Fields
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Linked to screens
            </th>
            <SortableHeader label="Updated" sortKey="updatedAt" sort={sort} onSort={onSort} />
            {hasActions && (
              <th scope="col" className={HEAD_CLASS}>
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className={cx(loading && !showSkeleton && 'opacity-60')}>
          {showSkeleton
            ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <tr key={index} aria-hidden="true" className="border-t border-divider">
                  <td className="px-3 py-3.5">
                    <Skeleton className="h-8 w-48" />
                  </td>
                  <td className="px-3 py-3.5">
                    <Skeleton className="h-5 w-20" />
                  </td>
                  <td className="px-3 py-3.5">
                    <Skeleton className="ml-auto h-4 w-8" />
                  </td>
                  <td className="px-3 py-3.5">
                    <Skeleton className="h-4 w-16" />
                  </td>
                  <td className="px-3 py-3.5">
                    <Skeleton className="h-4 w-32" />
                  </td>
                  {hasActions && (
                    <td className="px-3 py-3.5">
                      <Skeleton className="size-7.5" />
                    </td>
                  )}
                </tr>
              ))
            : rows.map((row) => (
                <tr key={row.id} className="border-t border-divider hover:bg-control-hover">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-chip bg-accent-soft text-accent-ink"
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
                  <td className="px-3 py-2.5">
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
                  <td className="px-3 py-2.5 text-right text-label text-ink-900 tabular-nums">
                    {row.fieldCount}
                  </td>
                  <td className="px-3 py-2.5 text-label text-ink-900">
                    {row.documented ? 'Yes' : <Tag tone="warning">Not linked</Tag>}
                  </td>
                  <td className="px-3 py-2.5 text-label whitespace-nowrap text-ink-700">
                    {formatTimestamp(row.updatedAt)}
                  </td>
                  {hasActions && <td className="px-3 py-2.5 text-right">{renderActions(row)}</td>}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
