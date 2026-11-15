// searchQuery: what the page may ask the API (D-105) and how it asks it. Pure functions.
// validateSearchText(q) -> null | 'tooShort' | 'tooLong': the rule of the contract on the TRIMMED text, counted in
//   characters (code points, as the validator counts): 2 to 100. An empty text is not an error (the search then
//   needs a filter).
// searchState(params) -> what the page does:
//   'invalid'  the text is shorter than 2 or longer than 100 once trimmed: the error shows in the field and NOTHING is
//              sent (not even the filters), so the API never receives a text the validator would refuse.
//   'initial'  no text and no filter: nothing is sent either (the API would answer 400 `required`).
//   'ready'    ask the API.
// listQuery(applicationId, params) -> the query of the list: the text (if any), the types (if any), the three filters,
//   the page and the page size.
// totalQuery(applicationId, params, type) -> the query of the total of ONE type for its chip: the same text and the
//   same filters, WITHOUT the selection of types (a chip says how many there are of its type, whatever is selected),
//   with that single type, page 1 and page size 1: the answer is read for its `total` only.
import type { operations } from '../../api/schema';

import { hasSearchFilters, type SearchListParams } from './useSearchListParams';
import type { SearchElementType } from './searchTypes';

export type SearchApiQuery = NonNullable<operations['search']['parameters']['query']>;

export const SEARCH_TEXT_MIN = 2;
export const SEARCH_TEXT_MAX = 100;

export type SearchTextError = 'tooShort' | 'tooLong';

export function validateSearchText(q: string): SearchTextError | null {
  const length = Array.from(q.trim()).length;
  if (length === 0) return null;
  if (length < SEARCH_TEXT_MIN) return 'tooShort';
  if (length > SEARCH_TEXT_MAX) return 'tooLong';
  return null;
}

export type SearchState = 'initial' | 'invalid' | 'ready';

export function searchState(params: SearchListParams): SearchState {
  if (validateSearchText(params.q) !== null) return 'invalid';
  if (params.q === '' && !hasSearchFilters(params)) return 'initial';
  return 'ready';
}

function textAndFilters(params: SearchListParams) {
  return {
    ...(params.q !== '' && { q: params.q }),
    ...(params.environment !== '' && { environment: params.environment }),
    ...(params.status !== '' && { documentationStatus: params.status }),
    ...(params.scope !== '' && { scope: params.scope }),
  };
}

export function listQuery(applicationId: number, params: SearchListParams): SearchApiQuery {
  return {
    applicationId,
    ...textAndFilters(params),
    ...(params.types.length > 0 && { types: params.types }),
    page: params.page,
    pageSize: params.pageSize,
  };
}

export function totalQuery(
  applicationId: number,
  params: SearchListParams,
  type: SearchElementType,
): SearchApiQuery {
  return { applicationId, ...textAndFilters(params), types: [type], page: 1, pageSize: 1 };
}
