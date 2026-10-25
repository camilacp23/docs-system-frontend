// CollectionsListPage: /collections (S-14; the Reader gets no create button and no row actions).
// Page header with the counts ("4 collections · 1 not linked to any screen"), filter bar, table and pagination.
// Filters, sort and page live in the URL (useCollectionListParams), so the list can be shared; changing the
// application resets them. Until the screens module exists almost every collection is "Not linked": that is what the
// data says and it is shown as it is. Loading shows a skeleton only after 300 ms (Table 58); an empty list offers
// "Clear filters" when filters are set; a failure shows the server error state with a retry. The page subtitle says
// why writing is disabled when the application is archived (S-09b).
import { Database, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { useApplication } from '../../application/useApplication';
import {
  ActionMenu,
  Button,
  EmptyState,
  ErrorState,
  ICON_STROKE_WIDTH,
  Pagination,
  SLOW_LOADING_MESSAGE,
  useDelayedLoading,
} from '../../components/ui';
import { ARCHIVED_WRITE_REASON } from '../../hooks/useWriteBlock';
import { useCurrentUser } from '../../session/useCurrentUser';
import { countText } from '../variables/variableLabels';

import { CollectionFilters } from './CollectionFilters';
import { CollectionTable } from './CollectionTable';
import type { CollectionSummary } from './collectionTypes';
import { CreateCollectionModal } from './CreateCollectionModal';
import { DeleteCollectionModal } from './DeleteCollectionModal';
import { useCollectionCounts } from './useCollectionCounts';
import { useCollectionListParams } from './useCollectionListParams';

const CARD_CLASS = 'rounded-card border border-border-subtle bg-surface shadow-card';

/** Changing the application starts the list over: the URL goes back to its defaults and the page state is rebuilt. */
export function CollectionsListPage() {
  const { currentApplicationId } = useApplication();
  const [, setSearch] = useSearchParams();
  const lastApplicationId = useRef(currentApplicationId);
  useEffect(() => {
    if (lastApplicationId.current !== null && lastApplicationId.current !== currentApplicationId) {
      setSearch(new URLSearchParams(), { replace: true });
    }
    lastApplicationId.current = currentApplicationId;
  }, [currentApplicationId, setSearch]);
  return <CollectionsList key={currentApplicationId ?? 'none'} />;
}

function CollectionsList() {
  const client = useApi();
  const user = useCurrentUser();
  const canWrite = user !== null && user.role !== 'READER';
  const [search, setSearch] = useSearchParams();
  // The creation modal is part of the URL (?new=1), so it can be linked and the back button closes it.
  const creating = canWrite && search.get('new') === '1';
  const setCreating = (open: boolean) => {
    setSearch((current) => {
      const next = new URLSearchParams(current);
      if (open) next.set('new', '1');
      else next.delete('new');
      return next;
    });
  };
  const { currentApplication, currentApplicationId } = useApplication();
  const { params, setParams, clearFilters, hasFilters } = useCollectionListParams();
  const archived = currentApplication?.status === 'ARCHIVED';
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<CollectionSummary | null>(null);

  const query = {
    applicationId: currentApplicationId ?? 0,
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    ...(params.q !== '' && { q: params.q }),
    ...(params.environment !== '' && { environment: params.environment }),
    ...(params.undocumented && { undocumented: true }),
  };

  const list = useApiResource<{ rows: CollectionSummary[]; total: number }>(
    `collections:${JSON.stringify(query)}`,
    async (signal) => {
      const { body } = await client.get('/collections', { query, signal });
      return { body: { rows: body.data, total: body.total }, etag: null };
    },
    currentApplicationId !== null,
  );
  const counts = useCollectionCounts(currentApplicationId);
  const { showSkeleton, isSlow } = useDelayedLoading(list.loading);

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const applicationName = currentApplication?.name ?? '';

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-page-title font-extrabold text-ink-900">Collections</h1>
          <p className="text-body-lg text-ink-500">
            {archived ? (
              ARCHIVED_WRITE_REASON
            ) : counts.data === null ? null : (
              <>
                {countText(counts.data.total, 'collection')} ·{' '}
                {counts.data.undocumented > 0 ? (
                  <button
                    type="button"
                    aria-pressed={params.undocumented}
                    className="rounded-chip font-semibold text-primary hover:underline"
                    onClick={() => {
                      setParams({ undocumented: !params.undocumented });
                    }}
                  >
                    {counts.data.undocumented} not linked to any screen
                  </button>
                ) : (
                  <span>0 not linked to any screen</span>
                )}
              </>
            )}
          </p>
        </div>
        {canWrite && (
          <Button
            variant="primary"
            disabled={archived}
            title={archived ? ARCHIVED_WRITE_REASON : undefined}
            iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
            onClick={() => {
              setCreating(true);
            }}
          >
            New collection
          </Button>
        )}
      </div>

      <section aria-label="Collection list" className={CARD_CLASS}>
        <CollectionFilters
          params={params}
          setParams={setParams}
          hasFilters={hasFilters}
          onClear={clearFilters}
        />
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
                icon={<Database />}
                title="No results"
                description="No collections match these filters."
                action={
                  <Button variant="primary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Database />}
                title="No collections yet"
                description={`Record ${applicationName}'s collections, their fields and the variables they feed.`}
              />
            )}
          </div>
        ) : (
          <>
            <CollectionTable
              rows={rows}
              sort={params.sort}
              onSort={(sort) => {
                setParams({ sort });
              }}
              loading={list.loading}
              showSkeleton={showSkeleton}
              renderActions={
                canWrite
                  ? (row) => (
                      <ActionMenu
                        label={`Actions for ${row.name}`}
                        items={[
                          {
                            key: 'view',
                            label: 'View',
                            onSelect: () => {
                              void navigate(`/collections/${row.id}`);
                            },
                          },
                          {
                            key: 'edit',
                            label: 'Edit',
                            disabled: archived,
                            reason: ARCHIVED_WRITE_REASON,
                            onSelect: () => {
                              void navigate(`/collections/${row.id}/edit`);
                            },
                          },
                          {
                            key: 'delete',
                            label: 'Delete',
                            danger: true,
                            disabled: archived,
                            reason: ARCHIVED_WRITE_REASON,
                            onSelect: () => {
                              setDeleting(row);
                            },
                          },
                        ]}
                      />
                    )
                  : undefined
              }
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

      {deleting !== null && (
        <DeleteCollectionModal
          collection={deleting}
          onClose={() => {
            setDeleting(null);
          }}
          onDeleted={() => {
            setDeleting(null);
            // Deleting the last row of a page goes back one page, so the list is not left empty.
            if (rows.length === 1 && params.page > 1) setParams({ page: params.page - 1 });
            else list.reload();
            counts.reload();
          }}
        />
      )}

      {creating && (
        <CreateCollectionModal
          onClose={() => {
            setCreating(false);
          }}
          onCreated={() => {
            list.reload();
            counts.reload();
          }}
        />
      )}
    </>
  );
}
