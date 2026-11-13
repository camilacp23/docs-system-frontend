// ApplicationsListPage: /admin/applications, "Applications" (S-07). Administrator only: the route guard shows S-41b to
// the other roles, and the API answers 403 whatever the client does (NFR-03). Developers and Readers choose an
// application from the selector of the sidebar only.
// Page header with the counts ("3 applications · 1 archived", taken from the applications the shell already holds,
// so they follow every change) and "Register application", the filter bar (search by name, status), the table and
// the pagination. Search, status and page live in the URL (useApplicationListParams); the API orders by name.
// Registering and editing happen in a modal (ApplicationFormModal); the name of a row opens the edit form. After a
// write the list is read again and the applications of the shell are refreshed in place (selector, application card,
// archived strip), without reloading the page. The register modal is part of the URL (?new=1).
// Loading shows a skeleton only after 300 ms (Table 58); an empty list offers "Clear filters" when filters are set;
// a failure shows the server error state with a retry.
import { LayoutGrid, Pencil, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { useApplication } from '../../application/useApplication';
import {
  ActionMenu,
  Button,
  EmptyState,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHeader,
  Pagination,
  SLOW_LOADING_MESSAGE,
  useDelayedLoading,
} from '../../components/ui';
import { useOfflineBlock } from '../../hooks/useOfflineBlock';

import { ApplicationFilters } from './ApplicationFilters';
import { ApplicationFormModal } from './ApplicationFormModal';
import { ApplicationTable } from './ApplicationTable';
import type { Application } from './applicationLabels';
import { useApplicationListParams } from './useApplicationListParams';

const ACTION_ICON = { size: 16, strokeWidth: ICON_STROKE_WIDTH } as const;

/** "3 applications · 1 archived" ("1 application"; the archived part only when there is one). */
function countText(total: number, archived: number): string {
  const base = `${total} application${total === 1 ? '' : 's'}`;
  return archived > 0 ? `${base} · ${archived} archived` : base;
}

export function ApplicationsListPage() {
  const client = useApi();
  const { applications, status: shellStatus, refresh } = useApplication();
  const { blocked, reason } = useOfflineBlock();
  const [search, setSearch] = useSearchParams();
  const registering = search.get('new') === '1';
  const setRegistering = (open: boolean) => {
    setSearch((current) => {
      const next = new URLSearchParams(current);
      if (open) next.set('new', '1');
      else next.delete('new');
      return next;
    });
  };
  const [editing, setEditing] = useState<Application | null>(null);
  const { params, setParams, clearFilters, hasFilters } = useApplicationListParams();

  const query = {
    page: params.page,
    pageSize: params.pageSize,
    ...(params.q !== '' && { q: params.q }),
    ...(params.status !== '' && { status: params.status }),
  };

  const list = useApiResource<{ rows: Application[]; total: number }>(
    `applications:${JSON.stringify(query)}`,
    async (signal) => {
      const { body } = await client.get('/applications', { query, signal });
      return { body: { rows: body.data, total: body.total }, etag: null };
    },
  );
  const { showSkeleton, isSlow } = useDelayedLoading(list.loading);

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const archivedCount = applications.filter((a) => a.status === 'ARCHIVED').length;

  /** After a write: the list of this page and the applications of the shell are read again. */
  const saved = () => {
    list.reload();
    refresh();
  };

  return (
    <>
      <PageHeader
        icon={<LayoutGrid size={20} strokeWidth={ICON_STROKE_WIDTH} />}
        title="Applications"
        description={
          shellStatus === 'ready' ? countText(applications.length, archivedCount) : undefined
        }
        actions={
          <Button
            variant="primary"
            disabled={blocked}
            title={reason ?? undefined}
            iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
            onClick={() => {
              setRegistering(true);
            }}
          >
            Register application
          </Button>
        }
      />

      <section
        aria-label="Application list"
        className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-card"
      >
        <ApplicationFilters params={params} setParams={setParams} />
        {list.status === 'error' ? (
          <ErrorState
            variant="server-error"
            requestId={list.error?.requestId ?? undefined}
            className="py-14"
            onAction={list.reload}
          />
        ) : list.status === 'ready' && total === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={<LayoutGrid />}
              title="No results"
              description="No applications match these filters."
              action={
                <Button
                  variant="primary"
                  iconLeft={<X aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />}
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<LayoutGrid />}
              title="No applications yet"
              description="Register the first application to start documenting it."
              action={
                <Button
                  variant="primary"
                  disabled={blocked}
                  onClick={() => {
                    setRegistering(true);
                  }}
                >
                  Register application
                </Button>
              }
            />
          )
        ) : (
          <>
            <ApplicationTable
              rows={rows}
              loading={list.loading}
              showSkeleton={showSkeleton}
              onOpen={setEditing}
              renderActions={(row) => (
                <ActionMenu
                  label={`Actions for ${row.name}`}
                  items={[
                    {
                      key: 'edit',
                      label: 'Edit',
                      icon: <Pencil {...ACTION_ICON} />,
                      disabled: blocked,
                      reason: reason ?? undefined,
                      onSelect: () => {
                        setEditing(row);
                      },
                    },
                  ]}
                />
              )}
            />
            {isSlow && (
              <p className="px-4 py-3 text-small text-ink-500" role="status">
                {SLOW_LOADING_MESSAGE}
              </p>
            )}
            <Pagination
              page={params.page}
              pageSize={params.pageSize}
              total={total}
              disabled={list.loading}
              onPageChange={(page) => {
                setParams({ page });
              }}
              onPageSizeChange={(pageSize) => {
                setParams({ pageSize });
              }}
            />
          </>
        )}
      </section>

      {editing !== null && (
        <ApplicationFormModal
          applicationId={editing.id}
          onClose={() => {
            setEditing(null);
          }}
          onSaved={saved}
        />
      )}
      {registering && (
        <ApplicationFormModal
          onClose={() => {
            setRegistering(false);
          }}
          onSaved={saved}
        />
      )}
    </>
  );
}
