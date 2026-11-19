// VariableTable: the table of the variable list (S-10, S-10r).
// Props: rows (VariableSummary[]), sort (current `sort`), onSort(next), loading (rows are being replaced),
// showSkeleton (draw placeholder rows instead of the rows), renderActions (optional: the content of the last
// column for a row; omitted for the Reader, who sees no actions).
// Columns: Name (+ data type), Scope, Environments, Origin screen, Updated. Name, Scope and Updated are sortable (the
// columns of the contract whitelist that the table shows). Identifiers are in IBM Plex Mono.
import { CircleAlert, Monitor } from 'lucide-react';
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

import {
  DATA_TYPE_LABEL,
  ENVIRONMENTS,
  SCOPE_FUNCTION,
  SCOPE_LABEL,
  formatTimestamp,
} from './variableLabels';
import type { VariableSummary } from './variableTypes';

interface VariableTableProps {
  rows: readonly VariableSummary[];
  sort: string;
  onSort: (next: string) => void;
  loading: boolean;
  showSkeleton: boolean;
  renderActions?: (row: VariableSummary) => ReactNode;
}

const HEAD_CLASS =
  'px-3 py-3 text-left text-micro font-bold tracking-wider text-variable-ink uppercase';
const SKELETON_ROWS = 5;

function EnvironmentTags({ present }: { present: VariableSummary['environments'] }) {
  return (
    <span className="inline-flex gap-1">
      {ENVIRONMENTS.map((environment) =>
        present.includes(environment) ? (
          <Tag key={environment} tone={environment === 'PROD' ? 'success' : 'neutral'}>
            {environment}
          </Tag>
        ) : null,
      )}
    </span>
  );
}

export function VariableTable({
  rows,
  sort,
  onSort,
  loading,
  showSkeleton,
  renderActions,
}: VariableTableProps) {
  const hasActions = renderActions !== undefined;
  return (
    <div className="overflow-x-auto border-t border-border-subtle">
      <table aria-label="Variables" aria-busy={loading} className="w-full text-left">
        <thead className="bg-variable-soft/60">
          <tr>
            <SortableHeader
              label="Name"
              sortKey="name"
              sort={sort}
              onSort={onSort}
              className="py-3 pl-5 text-variable-ink"
            />
            <SortableHeader
              label="Scope"
              sortKey="scope"
              sort={sort}
              onSort={onSort}
              className="py-3 text-variable-ink"
            />
            <th scope="col" className={HEAD_CLASS}>
              Environments
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Origin screen
            </th>
            <SortableHeader
              label="Updated"
              sortKey="updatedAt"
              sort={sort}
              onSort={onSort}
              className="py-3 text-variable-ink"
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
                    <Skeleton className="h-5 w-28" />
                  </td>
                  <td className="px-3 py-3.5">
                    <Skeleton className="h-5 w-20" />
                  </td>
                  <td className="px-3 py-3.5">
                    <Skeleton className="h-4 w-28" />
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
                <tr
                  key={row.id}
                  className="border-t border-divider transition-colors duration-150 hover:bg-variable-soft/40 motion-reduce:transition-none"
                >
                  <td className="py-3 pr-3 pl-5">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-control bg-variable-soft text-variable-ink"
                      >
                        <ElementTypeIcon type="variable" />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <Link
                          to={`/variables/${row.id}`}
                          className="truncate rounded-chip font-mono text-label font-semibold text-identifier hover:underline"
                        >
                          {row.name}
                        </Link>
                        <span className="text-small text-ink-500">
                          {DATA_TYPE_LABEL[row.dataType]}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Tag tone={row.scope === 'GLOBAL' ? 'info' : 'neutral'}>
                      {SCOPE_FUNCTION[row.scope]} · {SCOPE_LABEL[row.scope]}
                    </Tag>
                  </td>
                  <td className="px-3 py-3">
                    <EnvironmentTags present={row.environments} />
                  </td>
                  <td className="px-3 py-3">
                    {row.originScreen === null ? (
                      <Tag
                        tone="warning"
                        icon={<CircleAlert size={14} strokeWidth={ICON_STROKE_WIDTH} />}
                      >
                        Untraced
                      </Tag>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-mono text-label text-ink-900">
                        <Monitor
                          aria-hidden="true"
                          size={14}
                          strokeWidth={ICON_STROKE_WIDTH}
                          className="shrink-0 text-ink-500"
                        />
                        {row.originScreen.name}
                      </span>
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
