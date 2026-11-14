// ApplicationTable: the table of the application list (S-07).
// Props: rows (Application[]), loading (rows are being replaced), showSkeleton (draw placeholder rows instead of
// the rows), onOpen(row) (the name opens the edit form), renderActions (the content of the last column for a row).
// Columns: Name, Platform, Jira project ("TECHEA (default)" when it has no key), Status, App (OnStart) screen,
// Created by, Updated. The API orders by name and has no `sort`, so no header is sortable.
import type { ReactNode } from 'react';

import { Skeleton, Tag, cx } from '../../components/ui';

import {
  STATUS_LABEL,
  formatTimestamp,
  jiraProjectText,
  type Application,
} from './applicationLabels';

interface ApplicationTableProps {
  rows: readonly Application[];
  loading: boolean;
  showSkeleton: boolean;
  onOpen: (row: Application) => void;
  renderActions?: (row: Application) => ReactNode;
}

const HEAD_CLASS =
  'px-3 py-2.5 text-left text-micro font-bold tracking-wider text-ink-500 uppercase';
const SKELETON_ROWS = 5;
const SKELETON_WIDTHS = ['w-40', 'w-24', 'w-28', 'w-20', 'w-28', 'w-32', 'w-32'] as const;

export function ApplicationTable({
  rows,
  loading,
  showSkeleton,
  onOpen,
  renderActions,
}: ApplicationTableProps) {
  const hasActions = renderActions !== undefined;
  return (
    <div className="overflow-x-auto">
      <table aria-label="Applications" aria-busy={loading} className="w-full text-left">
        <thead className="bg-search-bg">
          <tr>
            <th scope="col" className={HEAD_CLASS}>
              Name
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Platform
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Jira project
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Status
            </th>
            <th scope="col" className={HEAD_CLASS}>
              App (OnStart) screen
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Created by
            </th>
            <th scope="col" className={HEAD_CLASS}>
              Updated
            </th>
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
                    <button
                      type="button"
                      onClick={() => {
                        onOpen(row);
                      }}
                      className="rounded-chip text-left font-semibold text-primary hover:underline"
                    >
                      {row.name}
                    </button>
                  </th>
                  <td className="px-3 py-3 text-body-lg text-ink-900">{row.platform}</td>
                  <td className="px-3 py-3 font-mono text-label text-ink-900">
                    {jiraProjectText(row.jiraProjectKey)}
                  </td>
                  <td className="px-3 py-3">
                    <Tag tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {STATUS_LABEL[row.status]}
                    </Tag>
                  </td>
                  <td className="px-3 py-3 font-mono text-label font-semibold text-identifier">
                    {row.appContextScreen.name}
                  </td>
                  <td className="px-3 py-3 text-body-lg text-ink-900">{row.createdBy.name}</td>
                  <td className="px-3 py-3 text-label whitespace-nowrap text-ink-700">
                    {formatTimestamp(row.updatedAt)}
                  </td>
                  {hasActions && <td className="px-3 py-3 text-right">{renderActions(row)}</td>}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
