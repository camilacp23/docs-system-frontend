// SearchPage: /search, the advanced search (FR-17, FR-18; S-29, S-29b, S-29c) for the three roles, over the application
// selected in the shell. The text, the types, the filters and the page live in the URL (useSearchListParams), so a
// search can be shared; changing the application starts it over.
// States (SDD Table 58): initial (no text and no filter, or a text that is too short or too long: nothing is asked);
// loading (skeleton after 300 ms, "This is taking longer than usual." after 10 s; the rows of the previous search
// stay, dimmed and marked busy, until the new ones arrive); no results (with "Clear filters" when filters are set);
// a failed read (S-41c inside the block, with a retry); an application that does not exist (S-41a, back to the
// Dashboard). An archived application is searched like any other (the search writes nothing). The 400 `required` of
// the API (a request with neither text nor filter) is the initial state, not an error.
// The number of results is announced in a polite live region once the page is read.
// The list keeps the order and the page of the API; the chips carry the total of each type (useSearchResults).
import { Search } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import type { ApiError } from '../../api/ApiError';
import { useApplication } from '../../application/useApplication';
import {
  Button,
  EmptyState,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHeader,
  Pagination,
  SLOW_LOADING_MESSAGE,
  SectionCard,
  Skeleton,
  useDelayedLoading,
} from '../../components/ui';

import { resultsHeading } from './searchLabels';
import { SearchFilters } from './SearchFilters';
import { SearchForm } from './SearchForm';
import { SearchResultItem } from './SearchResultItem';
import { useSearchListParams } from './useSearchListParams';
import { useSearchResults } from './useSearchResults';

const RESULT_PLACEHOLDERS = [0, 1, 2, 3] as const;

/** The 400 of a request with neither text nor filter: the page never sends it, and it is handled as the initial state. */
function isRequiredQuery(error: ApiError | null): boolean {
  if (error?.code !== 'VALIDATION_ERROR') return false;
  const fields = error.details?.fields;
  return (
    Array.isArray(fields) &&
    fields.some((field: unknown) => {
      const item = field as { field?: unknown; rule?: unknown };
      return item.field === 'q' && item.rule === 'required';
    })
  );
}

/** Changing the application starts the search over: the URL goes back to its defaults and the page state is rebuilt. */
export function SearchPage() {
  const { currentApplicationId } = useApplication();
  const [, setSearch] = useSearchParams();
  const lastApplicationId = useRef(currentApplicationId);
  useEffect(() => {
    if (lastApplicationId.current !== null && lastApplicationId.current !== currentApplicationId) {
      setSearch(new URLSearchParams(), { replace: true });
    }
    lastApplicationId.current = currentApplicationId;
  }, [currentApplicationId, setSearch]);
  return <AdvancedSearch key={currentApplicationId ?? 'none'} />;
}

function AdvancedSearch() {
  const navigate = useNavigate();
  const { currentApplication, currentApplicationId } = useApplication();
  const { params, setParams, clearFilters, clearAll, hasFilters, hasAnything } =
    useSearchListParams();
  const { state, list, totals } = useSearchResults(currentApplicationId, params);

  const asking = state === 'ready' && currentApplicationId !== null;
  const { showSkeleton, isSlow } = useDelayedLoading(asking && list.loading);

  const data = list.data;
  const requiredAnswer = list.status === 'error' && isRequiredQuery(list.error);
  const showInitial = !asking || requiredAnswer;
  const ready = asking && list.status === 'ready' && data !== null;

  // A page past the end (a shared link, or the last row of a page gone): go to the last page there is.
  useEffect(() => {
    if (ready && data.rows.length === 0 && data.total > 0 && params.page > 1) {
      setParams({ page: Math.max(1, Math.ceil(data.total / params.pageSize)) }, { replace: true });
    }
  }, [ready, data, params.page, params.pageSize, setParams]);

  if (asking && list.error?.code === 'NOT_FOUND') {
    return (
      <ErrorState
        variant="not-found"
        element="application"
        listLabel="Dashboard"
        className="flex-1"
        onAction={() => {
          void navigate('/dashboard');
        }}
      />
    );
  }

  const retry = () => {
    list.reload();
    for (const resource of Object.values(totals))
      if (resource.status === 'error') resource.reload();
  };

  return (
    <>
      <PageHeader
        icon={<Search size={20} strokeWidth={ICON_STROKE_WIDTH} />}
        title="Advanced search"
        description={`Search across screens, variables, collections and components of ${currentApplication?.name ?? 'the application'}.`}
      />

      <SearchForm params={params} setParams={setParams}>
        <SearchFilters
          params={params}
          setParams={setParams}
          totals={totals}
          searching={asking && !requiredAnswer}
          canClear={hasAnything}
          onClearAll={clearAll}
        />
      </SearchForm>

      <p role="status" className="sr-only">
        {ready && !list.loading ? resultsHeading(data) : ''}
      </p>

      {showInitial ? (
        <div className="rounded-card border border-border-subtle bg-surface shadow-card">
          <EmptyState
            icon={<Search />}
            title="Search the documentation"
            description="Type at least 2 characters or choose a filter."
          />
        </div>
      ) : list.status === 'error' ? (
        <div className="rounded-card border border-border-subtle bg-surface shadow-card">
          <ErrorState
            variant="server-error"
            requestId={list.error?.requestId ?? undefined}
            className="py-14"
            onAction={retry}
          />
        </div>
      ) : data === null ? (
        <SectionCard title="Results" flush>
          <div aria-busy="true">
            {showSkeleton ? (
              <ul>
                {RESULT_PLACEHOLDERS.map((index) => (
                  <li
                    key={index}
                    className="flex items-start gap-4 border-b border-divider px-5 py-4"
                  >
                    <Skeleton className="size-10 shrink-0" />
                    <div className="flex flex-1 flex-col gap-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-24" />
            )}
            {isSlow && (
              <p className="px-5 py-3 text-small text-ink-500" role="status">
                {SLOW_LOADING_MESSAGE}
              </p>
            )}
          </div>
        </SectionCard>
      ) : data.total === 0 && !list.loading ? (
        <div className="rounded-card border border-border-subtle bg-surface shadow-card">
          <EmptyState
            icon={<Search />}
            title="No results"
            description="No elements match this search."
            action={
              hasFilters ? (
                <Button variant="primary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <SectionCard
          title={resultsHeading(data)}
          description={
            data.text === '' ? 'Sorted by name.' : 'Exact name matches first, then by name.'
          }
          flush
        >
          <ul
            aria-label="Search results"
            aria-busy={list.loading}
            className={list.loading ? 'opacity-60' : undefined}
          >
            {data.rows.map((result) => (
              <SearchResultItem
                key={`${result.type}:${result.id}`}
                result={result}
                text={data.text}
              />
            ))}
          </ul>
          {isSlow && (
            <p className="px-5 py-3 text-small text-ink-500" role="status">
              {SLOW_LOADING_MESSAGE}
            </p>
          )}
          <Pagination
            page={params.page}
            pageSize={params.pageSize}
            total={data.total}
            disabled={list.loading}
            onPageChange={(page) => {
              setParams({ page });
            }}
            onPageSizeChange={(pageSize) => {
              setParams({ pageSize });
            }}
          />
        </SectionCard>
      )}
    </>
  );
}
