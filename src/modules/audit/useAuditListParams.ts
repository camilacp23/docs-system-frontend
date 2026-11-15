// useAuditListParams: the filters and the page of the audit log, kept in the URL so a view can be shared (FR-21).
// useAuditListParams() -> { params, setParams(patch, options?), clearFilters, hasFilters }
//   Query names: application (only "all"; absent = the application selected in the shell), type (AuditEntityType),
//   entityId, action (CREATE | UPDATE | DELETE | EVENT), actor (user id), from and to (days, YYYY-MM-DD), page,
//   pageSize (20, 50 or 100). A value that is missing, empty, the default or not valid is dropped from the URL, and
//   any change of a filter or of the page size goes back to page 1. Unknown parameters are kept.
//   `from` / `to` absent in the URL is not "no range": the page applies Last 7 days and writes it to the URL.
//   `hasFilters` covers everything except the dates (the page compares the range with its default).
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { PAGE_SIZES } from '../../components/ui';

import { isValidDay } from './auditDates';
import { ACTIONS, ENTITY_TYPES, type AuditAction, type AuditEntityType } from './auditLabels';

export const DEFAULT_PAGE_SIZE = 20;

export interface AuditListParams {
  /** 'selected': the application of the shell; 'all': no application filter. */
  application: 'selected' | 'all';
  type: AuditEntityType | '';
  entityId: string;
  action: AuditAction | '';
  /** User id as text, '' = anyone. */
  actor: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
}

type ParamKey = keyof AuditListParams;

const FILTER_KEYS = ['application', 'type', 'entityId', 'action', 'actor', 'from', 'to'] as const;
const LIST_KEYS = [...FILTER_KEYS, 'page', 'pageSize'] as const;
/** The filters that narrow the list besides the dates. */
const NARROWING_KEYS = ['application', 'type', 'entityId', 'action', 'actor'] as const;

function positiveInteger(value: string | null): number | null {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

function validDay(value: string | null): string {
  return value !== null && isValidDay(value) ? value : '';
}

export function parseAuditListParams(search: URLSearchParams): AuditListParams {
  const pageSize = positiveInteger(search.get('pageSize'));
  const actor = positiveInteger(search.get('actor'));
  return {
    application: search.get('application') === 'all' ? 'all' : 'selected',
    type: ENTITY_TYPES.find((type) => type === search.get('type')) ?? '',
    entityId: (search.get('entityId') ?? '').slice(0, 50),
    action: ACTIONS.find((action) => action === search.get('action')) ?? '',
    actor: actor === null ? '' : String(actor),
    from: validDay(search.get('from')),
    to: validDay(search.get('to')),
    page: positiveInteger(search.get('page')) ?? 1,
    pageSize: pageSize !== null && PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

function isDefault(key: ParamKey, value: string | number): boolean {
  switch (key) {
    case 'application':
      return value === 'selected';
    case 'page':
      return value === 1;
    case 'pageSize':
      return value === DEFAULT_PAGE_SIZE;
    default:
      return value === '';
  }
}

export function useAuditListParams() {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => parseAuditListParams(search), [search]);

  const setParams = useCallback(
    (patch: Partial<AuditListParams>, options: { replace?: boolean } = {}) => {
      setSearch(
        (current) => {
          const next = new URLSearchParams(current);
          for (const key of LIST_KEYS) {
            const value = patch[key];
            if (value === undefined) continue;
            if (isDefault(key, value)) next.delete(key);
            else next.set(key, String(value));
          }
          if (!('page' in patch)) next.delete('page');
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

  const hasFilters = NARROWING_KEYS.some((key) => !isDefault(key, params[key]));
  return { params, setParams, clearFilters, hasFilters };
}
