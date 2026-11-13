// useApplicationListParams: the filters and page of the application list, kept in the URL so a list can be shared.
// useApplicationListParams() -> { params, setParams(patch, options?), clearFilters, hasFilters }
//   Query names: q, status, page, pageSize (as GET /applications, which has no `sort`: the order is by name, then
//   id). `status` is "" (All, the default of S-07) or ACTIVE / ARCHIVED. A value that is missing, empty, the default
//   or not valid is dropped from the URL, and any change of a filter or of the page size goes back to page 1.
//   Unknown parameters are kept.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { PAGE_SIZES } from '../../components/ui';

import type { ApplicationStatus } from './applicationLabels';

export const DEFAULT_PAGE_SIZE = 20;
const STATUSES: readonly ApplicationStatus[] = ['ACTIVE', 'ARCHIVED'];

export interface ApplicationListParams {
  q: string;
  status: ApplicationStatus | '';
  page: number;
  pageSize: number;
}

const FILTER_KEYS = ['q', 'status'] as const;
const LIST_KEYS = [...FILTER_KEYS, 'page', 'pageSize'] as const;

function positiveInteger(value: string | null): number | null {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

export function parseApplicationListParams(search: URLSearchParams): ApplicationListParams {
  const pageSize = positiveInteger(search.get('pageSize'));
  return {
    q: (search.get('q') ?? '').slice(0, 100),
    status: STATUSES.find((status) => status === search.get('status')) ?? '',
    page: positiveInteger(search.get('page')) ?? 1,
    pageSize: pageSize !== null && PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

function isDefault(key: (typeof LIST_KEYS)[number], value: string | number): boolean {
  switch (key) {
    case 'page':
      return value === 1;
    case 'pageSize':
      return value === DEFAULT_PAGE_SIZE;
    default:
      return value === '';
  }
}

export function useApplicationListParams() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseApplicationListParams(search), [search]);

  const setParams = useCallback(
    (patch: Partial<ApplicationListParams>, options: { replace?: boolean } = {}) => {
      setSearch(
        (current) => {
          const next = new URLSearchParams(current);
          const touchesPage = 'page' in patch;
          for (const key of LIST_KEYS) {
            const value = patch[key];
            if (value === undefined) continue;
            if (isDefault(key, value)) next.delete(key);
            else next.set(key, String(value));
          }
          if (!touchesPage) next.delete('page');
          return next;
        },
        { replace: options.replace ?? false },
      );
    },
    [setSearch],
  );

  const clearFilters = useCallback(() => {
    setSearch(
      (current) => {
        const next = new URLSearchParams(current);
        for (const key of [...FILTER_KEYS, 'page']) next.delete(key);
        return next;
      },
      { replace: false },
    );
  }, [setSearch]);

  const hasFilters = FILTER_KEYS.some((key) => !isDefault(key, params[key]));
  return { params, setParams, clearFilters, hasFilters };
}
