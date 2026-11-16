// useQuickSearch: reads what the quick search shows. useQuickSearch(applicationId, text) ->
//   { phase, groups, total, pageText, error, showSkeleton, busy }
//   phase  'help'     the trimmed text has fewer than 2 characters (or none): nothing is asked.
//          'tooLong'  more than 100 characters once trimmed: nothing is asked.
//          'loading'  the answer is not here yet and there is no earlier answer to show.
//          'error'    the API failed for the text on the field.
//          'empty'    the answer has no rows.
//          'results'  rows to show (`busy` while a newer text is still being read: the rows are the earlier ones).
//   groups / total  the rows by type (quickSearchModel) and the `total` of the answer (the footer says it).
//   pageText  the text the rows were asked with: the marks follow the rows on screen, not the field.
// The text is asked SEARCH_DEBOUNCE_MS after the last key, through useApiResource, which owns an AbortController per
// request: a new text (or an unmount) aborts the one in flight and its answer is dropped if it still arrives, so an old
// answer never replaces a new one. The rule of the text is the one of /search (validateSearchText, D-105).
import { useEffect, useState } from 'react';

import type { ApiError } from '../api/ApiError';
import { useApi } from '../api/useApi';
import { useApiResource } from '../api/useApiResource';
import { useDelayedLoading } from '../components/ui/useDelayedLoading';
import { SEARCH_DEBOUNCE_MS } from '../hooks/useSearchDraft';
import { validateSearchText } from '../modules/search/searchQuery';
import type { SearchResult } from '../modules/search/searchTypes';

import { groupQuickResults, quickQuery, type QuickGroup } from './quickSearchModel';

export type QuickPhase = 'help' | 'tooLong' | 'loading' | 'error' | 'empty' | 'results';

interface QuickPage {
  applicationId: number;
  rows: SearchResult[];
  total: number;
  text: string;
}

export interface QuickSearch {
  phase: QuickPhase;
  groups: QuickGroup[];
  total: number;
  pageText: string;
  error: ApiError | null;
  showSkeleton: boolean;
  busy: boolean;
}

/** The value after it has stopped changing for SEARCH_DEBOUNCE_MS (the state changes in the timer, never in the effect body). */
function useDebounced(value: string): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (value === debounced) return;
    const timer = setTimeout(() => {
      setDebounced(value);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [value, debounced]);
  return debounced;
}

export function useQuickSearch(applicationId: number | null, text: string): QuickSearch {
  const client = useApi();
  const trimmed = text.trim();
  const textError = trimmed === '' ? 'tooShort' : validateSearchText(trimmed);
  const debounced = useDebounced(textError === null ? trimmed : '');
  // Only once the pause is over: while the text is still changing there is nothing to ask.
  const enabled =
    applicationId !== null && textError === null && debounced !== '' && debounced === trimmed;

  const query = quickQuery(applicationId ?? 0, debounced);
  const resource = useApiResource<QuickPage>(
    `quick-search:${JSON.stringify(query)}`,
    async (signal) => {
      const { body } = await client.get('/search', { query, signal });
      return {
        body: {
          applicationId: applicationId ?? 0,
          rows: body.data,
          total: body.total,
          text: debounced,
        },
        etag: null,
      };
    },
    enabled,
  );

  const waiting = textError === null && (debounced !== trimmed || resource.loading);
  // The rows of another application are never shown (the key changes with it, but `data` stays until the new answer).
  const earlier = resource.data?.applicationId === applicationId ? resource.data : null;
  const failed = !waiting && resource.status === 'error' && enabled;

  let phase: QuickPhase;
  if (textError === 'tooLong') phase = 'tooLong';
  else if (textError !== null || applicationId === null) phase = 'help';
  else if (failed) phase = 'error';
  else if (earlier === null || (waiting && earlier.rows.length === 0)) phase = 'loading';
  else phase = earlier.rows.length === 0 ? 'empty' : 'results';

  // The 300 ms of Table 58 count from the start of the request, not from the first key (the pause comes first).
  const showsRows = phase === 'results' || phase === 'empty';
  const { showSkeleton } = useDelayedLoading(phase === 'loading' && debounced === trimmed);
  return {
    phase,
    // Rows are shown only in the phases that draw them: after an error or while loading there are none.
    groups: earlier !== null && showsRows ? groupQuickResults(earlier.rows) : [],
    total: earlier?.total ?? 0,
    pageText: earlier?.text ?? '',
    error: failed ? resource.error : null,
    showSkeleton,
    busy: phase === 'results' && waiting,
  };
}
