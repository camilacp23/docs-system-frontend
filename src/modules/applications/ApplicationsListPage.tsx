// ApplicationsListPage: /admin/applications, "Applications" (S-07). Administrator only: the route guard shows S-41b to
// the other roles, and the API answers 403 whatever the client does (NFR-03). Developers and Readers choose an
// application from the selector of the sidebar only.
// The hero of the redesigned pages in forest green with the counts ("3 applications · 1 archived", taken from the applications the shell
// already holds, so they follow every change) and "Register" (named "Register application"), one "List" card with the filter
// strip (search by name, status), the table and the pagination. Search, status and page live in the URL (useApplicationListParams); the API orders by name.
// Registering and editing happen in a modal (ApplicationFormModal); the name of a row opens the edit form. After a
// write the list is read again and the applications of the shell are refreshed in place (selector, application card,
// archived strip), without reloading the page. The register modal is part of the URL (?new=1).
// The row menu has Edit and Archive (with a confirmation, S-09) or Unarchive (an archived application; no
// confirmation, as the Unarchive button of the archived strip has none). Both replace the whole representation: the
// application is read again and every field goes back with If-Match (useApplicationStatusChange). Archiving the
// application selected in the sidebar makes the archived strip appear on every other page at once.
// Loading shows a skeleton only after 300 ms (Table 58); an empty list offers "Clear filters" when filters are set;
// a failure shows the server error state with a retry.
import { Archive, ArchiveRestore, Blocks, ListFilter, Pencil, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { useApplication } from '../../application/useApplication';
import {
  ActionMenu,
  Button,
  EmptyState,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHero,
  Pagination,
  SLOW_LOADING_MESSAGE,
  ToneCard,
  useDelayedLoading,
  useToast,
} from '../../components/ui';
import { useOfflineBlock } from '../../hooks/useOfflineBlock';

import { ApplicationFilters } from './ApplicationFilters';
import { ApplicationFormModal } from './ApplicationFormModal';
import { ApplicationTable } from './ApplicationTable';
import { ArchiveApplicationModal } from './ArchiveApplicationModal';
import type { Application } from './applicationLabels';
import { useApplicationListParams } from './useApplicationListParams';
import { useApplicationStatusChange } from './useApplicationStatusChange';

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
  const toast = useToast();
  const changeStatus = useApplicationStatusChange();
  const [archiving, setArchiving] = useState<Application | null>(null);
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

  const unarchive = async (target: Application) => {
    try {
      const updated = await changeStatus(target.id, 'ACTIVE');
      toast.show({ message: `${updated.name} unarchived.` });
    } catch (thrown) {
      toast.show({
        tone: 'warning',
        message: getThrownMessage(thrown, { element: 'application' }),
      });
    }
    // Whatever happened, show what the server holds now (a 412 means someone else changed it).
    saved();
  };

  return (
    <>
      <PageHero
        tone="apps"
        icon={<Blocks size={20} strokeWidth={ICON_STROKE_WIDTH} />}
        title="Applications"
        description={
          shellStatus === 'ready'
            ? countText(applications.length, archivedCount)
            : 'The applications the department documents.'
        }
        actions={
          <Button
            size="sm"
            variant="primary"
            disabled={blocked}
            title={reason ?? undefined}
            aria-label="Register application"
            iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
            onClick={() => {
              setRegistering(true);
            }}
          >
            Register
          </Button>
        }
      />

      <ToneCard
        title="List"
        tone="apps"
        icon={<ListFilter size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        description="Search and filter the applications"
        actions={
          hasFilters && total > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              iconLeft={<X aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />}
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : undefined
        }
        flush
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
          <div className="border-t border-border-subtle">
            {hasFilters ? (
              <EmptyState
                icon={<Blocks />}
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
                icon={<Blocks />}
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
            )}
          </div>
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
                  buttonLabel="Actions"
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
                    row.status === 'ACTIVE'
                      ? {
                          key: 'status',
                          label: 'Archive',
                          icon: <Archive {...ACTION_ICON} />,
                          danger: true,
                          disabled: blocked,
                          reason: reason ?? undefined,
                          onSelect: () => {
                            setArchiving(row);
                          },
                        }
                      : {
                          key: 'status',
                          label: 'Unarchive',
                          icon: <ArchiveRestore {...ACTION_ICON} />,
                          disabled: blocked,
                          reason: reason ?? undefined,
                          onSelect: () => {
                            void unarchive(row);
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
      </ToneCard>

      {editing !== null && (
        <ApplicationFormModal
          applicationId={editing.id}
          onClose={() => {
            setEditing(null);
          }}
          onSaved={saved}
        />
      )}
      {archiving !== null && (
        <ArchiveApplicationModal
          application={archiving}
          onClose={() => {
            setArchiving(null);
          }}
          onDone={saved}
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
