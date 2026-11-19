// ApplicationTable: the table of the application list (S-07), in the look of the Variables and Users tables: a green header band, a
// tile with the application icon before each name, soft hover rows and the "Actions" button at the end of the row.
// Props: rows (Application[]), loading (rows are being replaced), showSkeleton (draw placeholder rows instead of
// the rows), onOpen(row) (the name opens the edit form), renderActions (the content of the last column for a row).
// Columns: Name, Platform, Jira project ("TECHEA (default)" when it has no key), Status, App (OnStart) screen,
// Created by, Updated. The API orders by name and has no `sort`, so no header is sortable.
import { Blocks } from 'lucide-react';
import type { ReactNode } from 'react';

import { ICON_STROKE_WIDTH, Skeleton, Tag, cx } from '../../components/ui';

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
  'px-3 py-3 text-left text-micro font-bold tracking-wider text-apps-ink uppercase';
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
    <div className="overflow-x-auto border-t border-border-subtle">
      <table aria-label="Applications" aria-busy={loading} className="w-full text-left">
        <thead className="bg-apps-soft/60">
          <tr>
            <th scope="col" className={cx(HEAD_CLASS, 'pl-5')}>
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
                  {SKELETON_WIDTHS.map((width, cell) => (
                    <td key={cell} className={cx('py-3.5', cell === 0 ? 'pr-3 pl-5' : 'px-3')}>
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
                <tr
                  key={row.id}
                  className="border-t border-divider transition-colors duration-150 hover:bg-apps-soft/40 motion-reduce:transition-none"
                >
                  <th scope="row" className="py-3 pr-3 pl-5 text-left text-body-lg font-semibold">
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-9 shrink-0 items-center justify-center rounded-control bg-apps-soft text-apps-ink"
                      >
                        <Blocks size={16} strokeWidth={ICON_STROKE_WIDTH} />
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onOpen(row);
                        }}
                        className="rounded-chip text-left font-semibold text-ink-900 hover:text-apps-ink hover:underline"
                      >
                        {row.name}
                      </button>
                    </span>
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
