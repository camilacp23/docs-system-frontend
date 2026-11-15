// useVariableListParams: the filters, sort and page of the variable list, kept in the URL so a list can be shared.
// useVariableListParams() -> { params, setParams(patch, options?), clearFilters, hasFilters }
//   Query names are the ones of GET /variables (q, scope, dataType, environment, originScreenId, untraced, sort,
//   page, pageSize). A value that is missing, empty, the default or not valid is dropped from the URL, and any
//   change of a filter, the sort or the page size goes back to page 1. Unknown parameters (such as `new`, which
//   opens the creation modal) are kept.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { PAGE_SIZES } from '../../components/ui';

import { DATA_TYPES, ENVIRONMENTS, SCOPES } from './variableLabels';
import type { DataType, Environment, VariableScope } from './variableTypes';

export const DEFAULT_SORT = 'name';
export const DEFAULT_PAGE_SIZE = 20;
/** The columns the contract lets the list be ordered by (`sort`, prefix - for descending). */
export const SORT_KEYS = ['name', 'scope', 'dataType', 'updatedAt'] as const;

export interface VariableListParams {
  q: string;
  scope: VariableScope | '';
  dataType: DataType | '';
  environment: Environment | '';
  /** Id of the origin screen as text, or ''. */
  originScreenId: string;
  untraced: boolean;
  sort: string;
  page: number;
  pageSize: number;
}

const FILTER_KEYS = [
  'q',
  'scope',
  'dataType',
  'environment',
  'originScreenId',
  'untraced',
] as const;
const LIST_KEYS = [...FILTER_KEYS, 'sort', 'page', 'pageSize'] as const;

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | '' {
  return allowed.find((candidate) => candidate === value) ?? '';
}

function validSort(value: string | null): string {
  const key = value?.replace(/^-/, '');
  return value !== null && SORT_KEYS.some((allowed) => allowed === key) ? value : DEFAULT_SORT;
}

function positiveInteger(value: string | null): number | null {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

export function parseVariableListParams(search: URLSearchParams): VariableListParams {
  const pageSize = positiveInteger(search.get('pageSize'));
  return {
    q: (search.get('q') ?? '').slice(0, 100),
    scope: oneOf(search.get('scope'), SCOPES),
    dataType: oneOf(search.get('dataType'), DATA_TYPES),
    environment: oneOf(search.get('environment'), ENVIRONMENTS),
    originScreenId: positiveInteger(search.get('originScreenId'))?.toString() ?? '',
    untraced: search.get('untraced') === 'true',
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
    case 'untraced':
      return value === false;
    default:
      return value === '';
  }
}

export function useVariableListParams() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseVariableListParams(search), [search]);

  const setParams = useCallback(
    (patch: Partial<VariableListParams>, options: { replace?: boolean } = {}) => {
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
