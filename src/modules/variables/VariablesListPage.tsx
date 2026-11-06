// VariablesListPage: /variables (S-10; S-10r for the Reader, who gets no create button and no row actions).
// Page header, the four counters, filter bar, table and pagination. Filters, sort and page live in the URL
// (useVariableListParams), so the list can be shared; changing the application resets them. Loading shows a
// skeleton only after 300 ms (Table 58); an empty list offers "Clear filters" when filters are set; a failure
// shows the server error state with a retry. The page title says why writing is disabled when the application
// is archived (S-09b).
import { Braces, Eye, ListFilter, Network, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { useApplication } from '../../application/useApplication';
import {
  ActionMenu,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHeader,
  Pagination,
  SectionCard,
  SLOW_LOADING_MESSAGE,
  useDelayedLoading,
} from '../../components/ui';
import { ARCHIVED_WRITE_REASON } from '../../hooks/useWriteBlock';
import { useCurrentUser } from '../../session/useCurrentUser';

import { CreateVariableModal } from './CreateVariableModal';
import { DeleteVariableModal } from './DeleteVariableModal';

import { useScreenOptions } from './useScreenOptions';
import { useVariableKpis } from './useVariableKpis';
import { useVariableListParams } from './useVariableListParams';
import { VariableFilters } from './VariableFilters';
import { VariableKpis } from './VariableKpis';
import { VariableTable } from './VariableTable';
import type { VariableSummary } from './variableTypes';

const ACTION_ICON = { size: 16, strokeWidth: ICON_STROKE_WIDTH } as const;

/** Changing the application starts the list over: the URL goes back to its defaults and the page state is rebuilt. */
export function VariablesListPage() {
  const { currentApplicationId } = useApplication();
  const [, setSearch] = useSearchParams();
  const lastApplicationId = useRef(currentApplicationId);
  useEffect(() => {
    if (lastApplicationId.current !== null && lastApplicationId.current !== currentApplicationId) {
      setSearch(new URLSearchParams(), { replace: true });
    }
    lastApplicationId.current = currentApplicationId;
  }, [currentApplicationId, setSearch]);
  return <VariablesList key={currentApplicationId ?? 'none'} />;
}

function VariablesList() {
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
  const { params, setParams, clearFilters, hasFilters } = useVariableListParams();
  const archived = currentApplication?.status === 'ARCHIVED';
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<VariableSummary | null>(null);

  const query = {
    applicationId: currentApplicationId ?? 0,
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    ...(params.q !== '' && { q: params.q }),
    ...(params.scope !== '' && { scope: params.scope }),
    ...(params.dataType !== '' && { dataType: params.dataType }),
    ...(params.environment !== '' && { environment: params.environment }),
    ...(params.originScreenId !== '' && { originScreenId: Number(params.originScreenId) }),
    ...(params.untraced && { untraced: true }),
  };

  const list = useApiResource<{ rows: VariableSummary[]; total: number }>(
    `variables:${JSON.stringify(query)}`,
    async (signal) => {
      const { body } = await client.get('/variables', { query, signal });
      return { body: { rows: body.data, total: body.total }, etag: null };
    },
    currentApplicationId !== null,
  );
  const kpis = useVariableKpis(currentApplicationId);
  const screens = useScreenOptions(currentApplicationId);
  const { showSkeleton, isSlow } = useDelayedLoading(list.loading);

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const applicationName = currentApplication?.name ?? '';

  return (
    <>
      <PageHeader
        icon={<Braces size={20} strokeWidth={ICON_STROKE_WIDTH} />}
        title="Variables"
        description={
          archived
            ? ARCHIVED_WRITE_REASON
            : `Global and context variables of ${applicationName}, with where they are created and used.`
        }
        actions={
          <>
            <ButtonLink
              to="/dependency-map"
              iconLeft={<Network aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
            >
              View on map
            </ButtonLink>
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
                New variable
              </Button>
            )}
          </>
        }
      />

      <VariableKpis
        kpis={kpis.data}
        untracedActive={params.untraced}
        onToggleUntraced={() => {
          setParams({ untraced: !params.untraced });
        }}
      />

      <SectionCard
        title="Variable list"
        icon={<ListFilter size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        description="Search, filter and sort the variables of this application"
        count={list.status === 'ready' ? total : null}
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
        <VariableFilters params={params} setParams={setParams} screens={screens.data ?? []} />
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
                icon={<Braces />}
                title="No results"
                description="No variables match these filters."
                action={
                  <Button variant="primary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Braces />}
                title="No variables yet"
                description={`Record ${applicationName}'s variables and where they are created.`}
              />
            )}
          </div>
        ) : (
          <>
            <VariableTable
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
                            icon: <Eye {...ACTION_ICON} />,
                            onSelect: () => {
                              void navigate(`/variables/${row.id}`);
                            },
                          },
                          {
                            key: 'edit',
                            label: 'Edit',
                            icon: <Pencil {...ACTION_ICON} />,
                            disabled: archived,
                            reason: ARCHIVED_WRITE_REASON,
                            onSelect: () => {
                              void navigate(`/variables/${row.id}/edit`);
                            },
                          },
                          {
                            key: 'delete',
                            label: 'Delete',
                            icon: <Trash2 {...ACTION_ICON} />,
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
      </SectionCard>

      {deleting !== null && (
        <DeleteVariableModal
          variable={deleting}
          onClose={() => {
            setDeleting(null);
          }}
          onDeleted={() => {
            setDeleting(null);
            // Deleting the last row of a page goes back one page, so the list is not left empty.
            if (rows.length === 1 && params.page > 1) setParams({ page: params.page - 1 });
            else list.reload();
            kpis.reload();
          }}
        />
      )}

      {creating && (
        <CreateVariableModal
          screens={screens.data ?? []}
          onClose={() => {
            setCreating(false);
          }}
          onCreated={() => {
            list.reload();
            kpis.reload();
          }}
        />
      )}
    </>
  );
}
