// ScreensListPage: /screens (S-18; the Reader gets no row actions).
// Page header with the counts ("5 screens · 1 approved"), filter bar, table and pagination. Filters, sort and
// page live in the URL (useScreenListParams), so the list can be shared; changing the application resets them.
// App (OnStart) is always the first row (the API puts it there) with the "Reserved" tag. Loading shows a skeleton
// only after 300 ms (Table 58); an empty list offers "Clear filters" when filters are set; a failure shows the
// server error state with a retry. The page subtitle says why writing is disabled when the application is
// archived (S-09b): the counts stay and the reason follows them. The counts line is never blank: a skeleton while
// they load, "Couldn't load the counts." with a retry if they fail.
import { ListFilter, Monitor, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { useApplication } from '../../application/useApplication';
import {
  Button,
  EmptyState,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHeader,
  Pagination,
  SectionCard,
  SLOW_LOADING_MESSAGE,
  Skeleton,
  useDelayedLoading,
} from '../../components/ui';
import { ARCHIVED_WRITE_REASON } from '../../hooks/useWriteBlock';
import { useCurrentUser } from '../../session/useCurrentUser';
import { countText } from '../variables/variableLabels';

import { ScreenFilters } from './ScreenFilters';
import { ScreenTable } from './ScreenTable';
import type { ScreenSummary } from './screenTypes';
import { useScreenCounts } from './useScreenCounts';
import { useScreenListParams } from './useScreenListParams';

/** Changing the application starts the list over: the URL goes back to its defaults and the page state is rebuilt. */
export function ScreensListPage() {
  const { currentApplicationId } = useApplication();
  const [, setSearch] = useSearchParams();
  const lastApplicationId = useRef(currentApplicationId);
  useEffect(() => {
    if (lastApplicationId.current !== null && lastApplicationId.current !== currentApplicationId) {
      setSearch(new URLSearchParams(), { replace: true });
    }
    lastApplicationId.current = currentApplicationId;
  }, [currentApplicationId, setSearch]);
  return <ScreensList key={currentApplicationId ?? 'none'} />;
}

function ScreensList() {
  const client = useApi();
  const user = useCurrentUser();
  const { currentApplication, currentApplicationId } = useApplication();
  const { params, setParams, clearFilters, hasFilters } = useScreenListParams();
  const archived = currentApplication?.status === 'ARCHIVED';

  const query = {
    applicationId: currentApplicationId ?? 0,
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    ...(params.q !== '' && { q: params.q }),
    ...(params.status !== '' && { documentationStatus: params.status }),
    ...(params.mine && user !== null && { authorId: user.id }),
  };

  const list = useApiResource<{ rows: ScreenSummary[]; total: number }>(
    `screens:${JSON.stringify(query)}`,
    async (signal) => {
      const { body } = await client.get('/screens', { query, signal });
      return { body: { rows: body.data, total: body.total }, etag: null };
    },
    currentApplicationId !== null,
  );
  const counts = useScreenCounts(currentApplicationId);
  const { showSkeleton, isSlow } = useDelayedLoading(list.loading);

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const applicationName = currentApplication?.name ?? '';

  return (
    <>
      <PageHeader
        icon={<Monitor size={20} strokeWidth={ICON_STROKE_WIDTH} />}
        title="Screens"
        description={
          <>
            {counts.status === 'error' ? (
              <span>
                Couldn&apos;t load the counts.{' '}
                <button
                  type="button"
                  className="rounded-chip font-semibold text-primary hover:underline"
                  onClick={counts.reload}
                >
                  Try again
                </button>
              </span>
            ) : counts.data === null ? (
              <Skeleton className="mt-1.5 h-4 w-56" />
            ) : (
              <span>
                {countText(counts.data.total, 'screen')} · {counts.data.approved} approved
              </span>
            )}
            {archived && <span> · {ARCHIVED_WRITE_REASON}</span>}
          </>
        }
      />

      <SectionCard
        title="Screen list"
        icon={<ListFilter size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        description="Search, filter and sort the screens of this application"
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
        <ScreenFilters params={params} setParams={setParams} />
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
                icon={<Monitor />}
                title="No results"
                description="No screens match these filters."
                action={
                  <Button variant="primary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Monitor />}
                title="No screens yet"
                description={`Document ${applicationName}'s screens, their template and the variables and collections they use.`}
              />
            )}
          </div>
        ) : (
          <>
            <ScreenTable
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
      </SectionCard>
    </>
  );
}
