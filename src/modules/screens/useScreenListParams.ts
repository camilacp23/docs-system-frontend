// useScreenListParams: the filters, sort and page of the screen list, kept in the URL so a list can be shared.
// useScreenListParams() -> { params, setParams(patch, options?), clearFilters, hasFilters }
//   Query names: q, status (documentationStatus of GET /screens), mine (true = authored by me, sent as
//   authorId), sort, page, pageSize. A value that is missing, empty, the default or not valid is dropped from the
//   URL, and any change of a filter, the sort or the page size goes back to page 1. Unknown parameters (such as
//   `new`, which opens the creation modal) are kept.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { PAGE_SIZES } from '../../components/ui';

import { isApiStatus } from './screenLabels';
import type { ApiDocumentationStatus } from './screenTypes';

export const DEFAULT_SORT = 'name';
export const DEFAULT_PAGE_SIZE = 20;
/** The columns the contract lets the list be ordered by (`sort`, prefix - for descending). */
export const SORT_KEYS = ['name', 'documentationStatus', 'updatedAt', 'pendingSubtasks'] as const;

export interface ScreenListParams {
  q: string;
  status: ApiDocumentationStatus | '';
  mine: boolean;
  sort: string;
  page: number;
  pageSize: number;
}

const FILTER_KEYS = ['q', 'status', 'mine'] as const;
const LIST_KEYS = [...FILTER_KEYS, 'sort', 'page', 'pageSize'] as const;

function validSort(value: string | null): string {
  const key = value?.replace(/^-/, '');
  return value !== null && SORT_KEYS.some((allowed) => allowed === key) ? value : DEFAULT_SORT;
}

function positiveInteger(value: string | null): number | null {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

export function parseScreenListParams(search: URLSearchParams): ScreenListParams {
  const pageSize = positiveInteger(search.get('pageSize'));
  const status = search.get('status');
  return {
    q: (search.get('q') ?? '').slice(0, 100),
    status: isApiStatus(status) ? status : '',
    mine: search.get('mine') === 'true',
    sort: validSort(search.get('sort')),
    page: positiveInteger(search.get('page')) ?? 1,
    pageSize: pageSize !== null && PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

function isDefault(key: (typeof LIST_KEYS)[number], value: string | number | boolean): boolean {
  switch (key) {
    case 'sort':
      return value === DEFAULT_SORT;
    case 'page':
      return value === 1;
    case 'pageSize':
      return value === DEFAULT_PAGE_SIZE;
    case 'mine':
      return value === false;
    default:
      return value === '';
  }
}

export function useScreenListParams() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseScreenListParams(search), [search]);

  const setParams = useCallback(
    (patch: Partial<ScreenListParams>, options: { replace?: boolean } = {}) => {
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
