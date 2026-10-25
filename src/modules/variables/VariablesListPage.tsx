// VariablesListPage: /variables (S-10; S-10r for the Reader, who gets no create button and no row actions).
// Page header, the four counters, filter bar, table and pagination. Filters, sort and page live in the URL
// (useVariableListParams), so the list can be shared; changing the application resets them. Loading shows a
// skeleton only after 300 ms (Table 58); an empty list offers "Clear filters" when filters are set; a failure
// shows the server error state with a retry. The page title says why writing is disabled when the application
// is archived (S-09b).
import { Braces, Network } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { useApplication } from '../../application/useApplication';
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  ICON_STROKE_WIDTH,
  Pagination,
  SLOW_LOADING_MESSAGE,
  useDelayedLoading,
} from '../../components/ui';
import { ARCHIVED_WRITE_REASON } from '../../hooks/useWriteBlock';

import { useScreenOptions } from './useScreenOptions';
import { useVariableKpis } from './useVariableKpis';
import { useVariableListParams } from './useVariableListParams';
import { VariableFilters } from './VariableFilters';
import { VariableKpis } from './VariableKpis';
import { VariableTable } from './VariableTable';
import type { VariableSummary } from './variableTypes';

const CARD_CLASS = 'rounded-card border border-border-subtle bg-surface shadow-card';

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
  const { currentApplication, currentApplicationId } = useApplication();
  const { params, setParams, clearFilters, hasFilters } = useVariableListParams();
  const archived = currentApplication?.status === 'ARCHIVED';

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-page-title font-extrabold text-ink-900">Variables</h1>
          <p className="text-body-lg text-ink-500">
            {archived
              ? ARCHIVED_WRITE_REASON
              : `Global and context variables of ${applicationName}, with where they are created and used.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink
            to="/dependency-map"
            iconLeft={<Network aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
          >
            View on map
          </ButtonLink>
        </div>
      </div>

      <VariableKpis
        kpis={kpis.data}
        untracedActive={params.untraced}
        onToggleUntraced={() => {
          setParams({ untraced: !params.untraced });
        }}
      />

      <section aria-label="Variable list" className={CARD_CLASS}>
        <VariableFilters
          params={params}
          setParams={setParams}
          screens={screens.data ?? []}
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
    </>
  );
}
