// useCollectionListParams: the filters, sort and page of the collection list, kept in the URL so a list can be shared.
// useCollectionListParams() -> { params, setParams(patch, options?), clearFilters, hasFilters }
//   Query names are the ones of GET /collections (q, environment, undocumented, sort, page, pageSize). A value that
//   is missing, empty, the default or not valid is dropped from the URL, and any change of a filter, the sort or the
//   page size goes back to page 1. Unknown parameters (such as `new`, which opens the creation modal) are kept.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { PAGE_SIZES } from '../../components/ui';
import { ENVIRONMENTS } from '../variables/variableLabels';
import type { Environment } from '../variables/variableTypes';

export const DEFAULT_SORT = 'name';
export const DEFAULT_PAGE_SIZE = 20;
/** The columns the contract lets the list be ordered by (`sort`, prefix - for descending). */
export const SORT_KEYS = ['name', 'updatedAt'] as const;

export interface CollectionListParams {
  q: string;
  environment: Environment | '';
  /** true = only collections not linked to any screen. */
  undocumented: boolean;
  sort: string;
  page: number;
  pageSize: number;
}

const FILTER_KEYS = ['q', 'environment', 'undocumented'] as const;
const LIST_KEYS = [...FILTER_KEYS, 'sort', 'page', 'pageSize'] as const;

function validSort(value: string | null): string {
  const key = value?.replace(/^-/, '');
  return value !== null && SORT_KEYS.some((allowed) => allowed === key) ? value : DEFAULT_SORT;
}

function positiveInteger(value: string | null): number | null {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

export function parseCollectionListParams(search: URLSearchParams): CollectionListParams {
  const pageSize = positiveInteger(search.get('pageSize'));
  const environment = search.get('environment');
  return {
    q: (search.get('q') ?? '').slice(0, 100),
    environment: ENVIRONMENTS.find((candidate) => candidate === environment) ?? '',
    undocumented: search.get('undocumented') === 'true',
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
    case 'undocumented':
      return value === false;
    default:
      return value === '';
  }
}

export function useCollectionListParams() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseCollectionListParams(search), [search]);

  const setParams = useCallback(
    (patch: Partial<CollectionListParams>, options: { replace?: boolean } = {}) => {
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
