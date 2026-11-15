// useSearchResults: reads what the advanced search shows: the page of results and the total of each type.
// useSearchResults(applicationId, params) -> { state, list, totals }
//   state    'initial' | 'invalid' | 'ready' (searchQuery.ts): only 'ready' asks the API.
//   list     the page of results (the query has the text, the selected types, the filters, the page and the size).
//   totals   one reading per type, for the chips: the `total` of GET /search with pageSize=1, types=<that type>, the same
//            text and the same filters and NOT the selection of types. "All" is the sum of the four.
// Cost: a new text or filter reads the list and the four totals (5 requests, in parallel); a new page or a new
// selection of types reads only the list, because the key of the totals does not have them.
// Races: every reading is a useApiResource, which owns an AbortController per key: a new key (or an unmount) aborts the
// reading in flight and drops its answer if it still arrives, so a late answer never replaces the one of the
// current search.
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import type { ApiResource } from '../../api/useApiResource';

import { listQuery, searchState, totalQuery, type SearchState } from './searchQuery';
import { SEARCH_TYPES, type SearchElementType, type SearchResult } from './searchTypes';
import type { SearchListParams } from './useSearchListParams';

export interface SearchPage {
  rows: SearchResult[];
  total: number;
}

export type SearchTotals = Record<SearchElementType, ApiResource<number>>;

function useTotal(
  applicationId: number | null,
  params: SearchListParams,
  type: SearchElementType,
  enabled: boolean,
): ApiResource<number> {
  const client = useApi();
  const query = totalQuery(applicationId ?? 0, params, type);
  return useApiResource<number>(
    `search-total:${JSON.stringify(query)}`,
    async (signal) => {
      const { body } = await client.get('/search', { query, signal });
      return { body: body.total, etag: null };
    },
    enabled,
  );
}

export function useSearchResults(applicationId: number | null, params: SearchListParams) {
  const client = useApi();
  const state: SearchState = searchState(params);
  const enabled = state === 'ready' && applicationId !== null;

  const query = listQuery(applicationId ?? 0, params);
  const list = useApiResource<SearchPage>(
    `search:${JSON.stringify(query)}`,
    async (signal) => {
      const { body } = await client.get('/search', { query, signal });
      return { body: { rows: body.data, total: body.total }, etag: null };
    },
    enabled,
  );

  const screen = useTotal(applicationId, params, 'SCREEN', enabled);
  const variable = useTotal(applicationId, params, 'VARIABLE', enabled);
  const collection = useTotal(applicationId, params, 'COLLECTION', enabled);
  const component = useTotal(applicationId, params, 'COMPONENT', enabled);
  const totals: SearchTotals = {
    SCREEN: screen,
    VARIABLE: variable,
    COLLECTION: collection,
    COMPONENT: component,
  };
  return { state, list, totals };
}

/** The sum of the four totals (the "All" chip); null while any of them is unknown or failed. */
export function sumOfTotals(totals: SearchTotals): number | null {
  let sum = 0;
  for (const type of SEARCH_TYPES) {
    const value = totals[type].status === 'ready' ? totals[type].data : null;
    if (value === null) return null;
    sum += value;
  }
  return sum;
}
