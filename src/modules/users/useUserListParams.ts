// useUserListParams: the filters, sort and page of the user list, kept in the URL so a list can be shared.
// useUserListParams() -> { params, setParams(patch, options?), clearFilters, hasFilters }
//   Query names: q, role, status, sort, page, pageSize (as GET /users). `status` is ACTIVE by default (the screen
//   opens filtered by active users, S-02) and is left out of the URL then; "ALL" is the explicit choice of every
//   status and the API call omits the parameter. A value that is missing, empty, the default or not valid is dropped
//   from the URL, and any change of a filter, the sort or the page size goes back to page 1. Unknown parameters are
//   kept.
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { PAGE_SIZES } from '../../components/ui';

import { ROLES, type UserRole } from './userLabels';

export const DEFAULT_SORT = 'name';
export const DEFAULT_PAGE_SIZE = 20;
/** The columns the contract lets the list be ordered by (`sort`, prefix - for descending) that the table shows. */
export const SORT_KEYS = ['name', 'lastLoginAt', 'createdAt'] as const;

export type StatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';
const STATUS_FILTERS: readonly StatusFilter[] = ['ACTIVE', 'INACTIVE', 'ALL'];
export const DEFAULT_STATUS: StatusFilter = 'ACTIVE';

export interface UserListParams {
  q: string;
  role: UserRole | '';
  status: StatusFilter;
  sort: string;
  page: number;
  pageSize: number;
}

const FILTER_KEYS = ['q', 'role', 'status'] as const;
const LIST_KEYS = [...FILTER_KEYS, 'sort', 'page', 'pageSize'] as const;

function validSort(value: string | null): string {
  const key = value?.replace(/^-/, '');
  return value !== null && SORT_KEYS.some((allowed) => allowed === key) ? value : DEFAULT_SORT;
}

function positiveInteger(value: string | null): number | null {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

export function parseUserListParams(search: URLSearchParams): UserListParams {
  const pageSize = positiveInteger(search.get('pageSize'));
  return {
    q: (search.get('q') ?? '').slice(0, 100),
    role: ROLES.find((role) => role === search.get('role')) ?? '',
    status: STATUS_FILTERS.find((status) => status === search.get('status')) ?? DEFAULT_STATUS,
    sort: validSort(search.get('sort')),
    page: positiveInteger(search.get('page')) ?? 1,
    pageSize: pageSize !== null && PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

function isDefault(key: (typeof LIST_KEYS)[number], value: string | number): boolean {
  switch (key) {
    case 'sort':
      return value === DEFAULT_SORT;
    case 'page':
      return value === 1;
    case 'pageSize':
      return value === DEFAULT_PAGE_SIZE;
    case 'status':
      return value === DEFAULT_STATUS;
    default:
      return value === '';
  }
}

export function useUserListParams() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseUserListParams(search), [search]);

  const setParams = useCallback(
    (patch: Partial<UserListParams>, options: { replace?: boolean } = {}) => {
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
