// useReportListParams: the filter and the page of the report list, kept in the URL so a list can be shared.
// useReportListParams(canFilter) -> { params, setPublishedOnly(on), setPage(page), setPageSize(size), reset() }
//   Query names: published (only "true": the "Published" filter; absent = All), page, pageSize. The Reader never
//   filters (the API gives a Reader the published reports only), so `published` is ignored for that role.
//   A missing, default or invalid value is dropped from the URL; any change of the filter or of the page size goes
//   back to page 1. Unknown parameters are kept.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { PAGE_SIZE, PAGE_SIZES } from './reportModel';

export interface ReportListParams {
  publishedOnly: boolean;
  page: number;
  pageSize: number;
}

function positiveInteger(value: string | null): number | null {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

export function parseReportListParams(
  search: URLSearchParams,
  canFilter: boolean,
): ReportListParams {
  const pageSize = positiveInteger(search.get('pageSize'));
  return {
    publishedOnly: canFilter && search.get('published') === 'true',
    page: positiveInteger(search.get('page')) ?? 1,
    pageSize: pageSize !== null && PAGE_SIZES.includes(pageSize) ? pageSize : PAGE_SIZE,
  };
}

export function useReportListParams(canFilter: boolean) {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseReportListParams(search, canFilter), [search, canFilter]);

  const change = useCallback(
    (apply: (next: URLSearchParams) => void) => {
      setSearch((current) => {
        const next = new URLSearchParams(current);
        apply(next);
        return next;
      });
    },
    [setSearch],
  );

  const setPublishedOnly = useCallback(
    (on: boolean) => {
      change((next) => {
        if (on) next.set('published', 'true');
        else next.delete('published');
        next.delete('page');
      });
    },
    [change],
  );
  const setPage = useCallback(
    (page: number) => {
      change((next) => {
        if (page === 1) next.delete('page');
        else next.set('page', String(page));
      });
    },
    [change],
  );
  const setPageSize = useCallback(
    (size: number) => {
      change((next) => {
        if (size === PAGE_SIZE) next.delete('pageSize');
        else next.set('pageSize', String(size));
        next.delete('page');
      });
    },
    [change],
  );
  /** All reports, first page (after a report was requested, so the new one is on screen, D-141). */
  const reset = useCallback(() => {
    change((next) => {
      next.delete('published');
      next.delete('page');
    });
  }, [change]);

  return { params, setPublishedOnly, setPage, setPageSize, reset };
}
