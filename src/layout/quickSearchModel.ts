// quickSearchModel: what the quick search (S-30, D-48, D-133) asks the API and how it shapes the answer. Pure functions.
// quickQuery(applicationId, text) -> the query of the ONE request: the trimmed text, page 1, QUICK_SEARCH_PAGE_SIZE rows.
// groupQuickResults(rows) -> the rows grouped by type in the order of the frame S-30 (Screens, Collections,
//   Components, Variables), at most QUICK_SEARCH_GROUP_LIMIT rows per group, in the order the API gave them; a group
//   with no rows is left out.
// quickResultKey / quickResultHref / quickResultNote -> the identity, the route (elementHref: a component leads to the
//   Components & navigation tab of its screen, D-102) and the small grey note at the right of a row.
// searchAllHref(text) -> the route of the advanced search with the text ("See all results", Enter without a row).
import { encodeRfc3986 } from '../api/encodeQuery';
import { elementHref } from '../modules/dependency-map/nodeLinks';
import { MATCHED_IN_LABEL } from '../modules/search/searchLabels';
import type { SearchApiQuery } from '../modules/search/searchQuery';
import type { SearchElementType, SearchResult } from '../modules/search/searchTypes';

export const QUICK_SEARCH_PAGE_SIZE = 20;
export const QUICK_SEARCH_GROUP_LIMIT = 3;
export const QUICK_SEARCH_GROUP_ORDER: readonly SearchElementType[] = [
  'SCREEN',
  'COLLECTION',
  'COMPONENT',
  'VARIABLE',
];

export interface QuickGroup {
  type: SearchElementType;
  rows: SearchResult[];
}

export function quickQuery(applicationId: number, text: string): SearchApiQuery {
  return { applicationId, q: text, page: 1, pageSize: QUICK_SEARCH_PAGE_SIZE };
}

export function groupQuickResults(rows: readonly SearchResult[]): QuickGroup[] {
  return QUICK_SEARCH_GROUP_ORDER.map((type) => ({
    type,
    rows: rows.filter((row) => row.type === type).slice(0, QUICK_SEARCH_GROUP_LIMIT),
  })).filter((group) => group.rows.length > 0);
}

export function quickResultKey(result: SearchResult): string {
  return `${result.type}-${result.id}`;
}

export function quickResultHref(result: SearchResult): string {
  return result.type === 'COMPONENT'
    ? elementHref({ type: 'COMPONENT', screenId: result.screen.id })
    : elementHref({ type: result.type, id: result.id });
}

/**
 * The note of a row (S-30): a component says the screen it is in; a variable or a collection says where the text was
 * found when it was not the name ("matched in description"). A screen shows its status tag instead (no note).
 */
export function quickResultNote(result: SearchResult): string | null {
  if (result.type === 'COMPONENT') return result.screen.name;
  if (result.type === 'SCREEN') return null;
  const matchedIn = result.matchedIn;
  if (matchedIn === null || matchedIn === 'name') return null;
  return `matched in ${(MATCHED_IN_LABEL[matchedIn] ?? matchedIn).toLowerCase()}`;
}

export function searchAllHref(text: string): string {
  return `/search?q=${encodeRfc3986(text)}`;
}

// The texts of the quick search (approved for DESIGN_REFERENCE §9; the error text comes from the catalog).
export const QUICK_ALL_KEY = 'all';

export const QUICK_HELP_TEXT = 'Type at least 2 characters to search.';
export const QUICK_TOO_LONG_TEXT = 'Use up to 100 characters.';
export const QUICK_EMPTY_TITLE = 'No results';
export const QUICK_FIELD_LABEL = 'Quick search';
export const QUICK_PLACEHOLDER = 'Search screens, variables, collections, components…';

export function quickEmptyText(applicationName: string, text: string): string {
  return `Nothing in ${applicationName} matches “${text}”. Try another word or open advanced search.`;
}

export function quickAllText(text: string): string {
  return `See all results for “${text}”`;
}

/** The shortcut drawn in the field: Cmd on Apple platforms, Ctrl elsewhere (the frame draws "Ctrl K"). */
export function shortcutHint(): string {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent)
    ? '⌘ K'
    : 'Ctrl K';
}
