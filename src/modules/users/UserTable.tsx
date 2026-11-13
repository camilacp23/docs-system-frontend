// UserTable: the table of the user list (S-02).
// Props: rows (User[]), sort (current `sort`), onSort(next), loading (rows are being replaced), showSkeleton (draw
// placeholder rows instead of the rows), currentUserId (that row says "(you)"), renderActions (the content of the
// last column for a row).
// Columns: Name, Email, Role, Status, Last sign-in, Created. Name, Last sign-in and Created are sortable (the
// columns of the contract whitelist that the table shows).
import type { ReactNode } from 'react';

import { Skeleton, SortableHeader, Tag, cx } from '../../components/ui';

import { ROLE_LABEL, STATUS_LABEL, formatDate, formatLastSignIn, type User } from './userLabels';

interface UserTableProps {
  rows: readonly User[];
  sort: string;
  onSort: (next: string) => void;
  loading: boolean;
  showSkeleton: boolean;
  currentUserId: number | null;
  renderActions?: (row: User) => ReactNode;
}

const HEAD_CLASS =
  'px-3 py-2.5 text-left text-micro font-bold tracking-wider text-ink-500 uppercase';
const SKELETON_ROWS = 5;
const SKELETON_WIDTHS = ['w-48', 'w-56', 'w-24', 'w-20', 'w-32', 'w-24'] as const;

export function UserTable({
  rows,
  sort,
  onSort,
  loading,
  showSkeleton,
  currentUserId,
  renderActions,
}: UserTableProps) {
  const hasActions = renderActions !== undefined;
  return (
    <div className="overflow-x-auto">
      <table aria-label="Users" aria-busy={loading} className="w-full text-left">
        <thead className="bg-search-bg">
          <tr>
            <SortableHeader label="Name" sortKey="name" sort={sort} onSort={onSort} />
            <th scope="col" className={HEAD_CLASS}>
              Email
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Role
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Status
            </th>
            <SortableHeader
              label="Last sign-in"
              sortKey="lastLoginAt"
              sort={sort}
              onSort={onSort}
            />
            <SortableHeader label="Created" sortKey="createdAt" sort={sort} onSort={onSort} />
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
                  {SKELETON_WIDTHS.map((width, cell) => (
                    <td key={cell} className="px-3 py-3.5">
                      <Skeleton className={cx('h-5', width)} />
                    </td>
                  ))}
                  {hasActions && (
                    <td className="px-3 py-3.5">
                      <Skeleton className="size-7.5" />
                    </td>
                  )}
                </tr>
              ))
            : rows.map((row) => (
                <tr key={row.id} className="border-t border-divider hover:bg-control-hover">
                  <th scope="row" className="px-3 py-3 text-left text-body-lg font-semibold">
                    {row.name}
                    {row.id === currentUserId && (
                      <span className="font-semibold text-ink-900"> (you)</span>
                    )}
                  </th>
                  <td className="px-3 py-3 text-body-lg text-ink-900">{row.email}</td>
                  <td className="px-3 py-3">
                    <Tag>{ROLE_LABEL[row.role]}</Tag>
                  </td>
                  <td className="px-3 py-3">
                    <Tag tone={row.status === 'ACTIVE' ? 'success' : 'danger'}>
                      {STATUS_LABEL[row.status]}
                    </Tag>
                  </td>
                  <td className="px-3 py-3 text-label whitespace-nowrap text-ink-700">
                    {formatLastSignIn(row.lastLoginAt)}
                  </td>
                  <td className="px-3 py-3 text-label whitespace-nowrap text-ink-700">
                    {formatDate(row.createdAt)}
                  </td>
                  {hasActions && <td className="px-3 py-3 text-right">{renderActions(row)}</td>}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
