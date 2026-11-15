// useSearchListParams: the text, the types, the filters and the page of the advanced search, kept in the URL so a
// search can be shared (FR-17, FR-18).
// useSearchListParams() -> { params, setParams(patch, options?), clearFilters, clearAll, hasFilters, hasAnything }
//   Query names: q (the text, trimmed), types (comma-separated, canonical order; all four is the same as none and
//   leaves no parameter), environment (DEV | PROD), status (the documentationStatus of the API), scope (GLOBAL |
//   CONTEXT), page, pageSize. A value that is missing, empty, the default or not valid is dropped from the URL.
//   ANY change of the text, the types or a filter (and of the page size) goes back to page 1; only a change that
//   names `page` keeps it. Unknown parameters are kept.
//   q is NOT cut at 100 characters: a longer text stays in the field with its error, and is never sent.
//   clearFilters: the types and the three selects go, the text stays. clearAll: the text goes too (the initial state).
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { PAGE_SIZES } from '../../components/ui';
import { isApiStatus } from '../screens/screenLabels';

import {
  SEARCH_ENVIRONMENTS,
  SEARCH_TYPES,
  type SearchElementType,
  type SearchEnvironment,
  type SearchScope,
  type SearchStatus,
} from './searchTypes';

export const DEFAULT_PAGE_SIZE = 20;

export interface SearchListParams {
  q: string;
  types: SearchElementType[];
  environment: SearchEnvironment | '';
  status: SearchStatus | '';
  scope: SearchScope | '';
  page: number;
  pageSize: number;
}

const FILTER_KEYS = ['types', 'environment', 'status', 'scope'] as const;
const LIST_KEYS = ['q', ...FILTER_KEYS, 'page', 'pageSize'] as const;

function positiveInteger(value: string | null): number | null {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

/** The valid types of a list, once each and in the canonical order; all four count as none. */
export function normalizeTypes(types: readonly string[]): SearchElementType[] {
  const chosen = SEARCH_TYPES.filter((type) => types.includes(type));
  return chosen.length === SEARCH_TYPES.length ? [] : chosen;
}

export function parseSearchListParams(search: URLSearchParams): SearchListParams {
  const pageSize = positiveInteger(search.get('pageSize'));
  const environment = search.get('environment');
  const status = search.get('status');
  const scope = search.get('scope');
  return {
    q: (search.get('q') ?? '').trim(),
    types: normalizeTypes((search.get('types') ?? '').split(',')),
    environment: SEARCH_ENVIRONMENTS.find((value) => value === environment) ?? '',
    status: isApiStatus(status) ? status : '',
    scope: scope === 'GLOBAL' || scope === 'CONTEXT' ? scope : '',
    page: positiveInteger(search.get('page')) ?? 1,
    pageSize: pageSize !== null && PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

function isDefault(key: (typeof LIST_KEYS)[number], value: string | number | string[]): boolean {
  switch (key) {
    case 'page':
      return value === 1;
    case 'pageSize':
      return value === DEFAULT_PAGE_SIZE;
    case 'types':
      return Array.isArray(value) && value.length === 0;
    default:
      return value === '';
  }
}

/** Whether a type, an environment, a status or a scope is chosen (the text is not a filter). */
export function hasSearchFilters(params: SearchListParams): boolean {
  return FILTER_KEYS.some((key) => !isDefault(key, params[key]));
}

export function useSearchListParams() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseSearchListParams(search), [search]);

  const setParams = useCallback(
    (patch: Partial<SearchListParams>, options: { replace?: boolean } = {}) => {
      setSearch(
        (current) => {
          const next = new URLSearchParams(current);
          const touchesPage = 'page' in patch;
          for (const key of LIST_KEYS) {
            const value = patch[key];
            if (value === undefined) continue;
            const normalized = key === 'types' ? normalizeTypes(value as string[]) : value;
            if (isDefault(key, normalized)) next.delete(key);
            else
              next.set(key, Array.isArray(normalized) ? normalized.join(',') : String(normalized));
          }
          if (!touchesPage) next.delete('page');
          return next;
        },
        { replace: options.replace ?? false },
      );
    },
    [setSearch],
  );

  const clear = useCallback(
    (keys: readonly string[]) => {
      setSearch(
        (current) => {
          const next = new URLSearchParams(current);
          for (const key of [...keys, 'page']) next.delete(key);
          return next;
        },
        { replace: false },
      );
    },
    [setSearch],
  );

  const clearFilters = useCallback(() => {
    clear(FILTER_KEYS);
  }, [clear]);
  const clearAll = useCallback(() => {
    clear(['q', ...FILTER_KEYS]);
  }, [clear]);

  const hasFilters = hasSearchFilters(params);
  return {
    params,
    setParams,
    clearFilters,
    clearAll,
    hasFilters,
    hasAnything: hasFilters || params.q !== '',
  };
}
