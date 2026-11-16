// useScreenSearch: the screens of an application found by name, 20 at a time, for the screen selector of S-34.
// useScreenSearch(applicationId, search, enabled) -> { status, items, total, error, hasMore, loadingMore, moreFailed, loadMore }
//   One request per (application, search): GET /screens?applicationId=…&q=…&page=1&pageSize=20 (sorted by name; a search of
//   '' sends no `q`). A new search aborts the one in flight and its answer is dropped if it still arrives. `loadMore`
//   reads the next page and appends it (a screen that is already there is not added twice); a new search drops the pages
//   that were appended. Nothing is read until `enabled`, so the dialog that closed or a form that does not apply costs nothing.
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, isApiError } from '../../api/ApiError';
import { useApi } from '../../api/useApi';
import type { ScreenSummary } from '../screens/screenTypes';

export const SCREEN_PAGE_SIZE = 20;

interface Loaded {
  key: string;
  items: ScreenSummary[];
  page: number;
  total: number;
}

export function useScreenSearch(applicationId: number | null, search: string, enabled: boolean) {
  const client = useApi();
  const key = `${applicationId ?? 'none'}|${search}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<{ key: string; error: ApiError } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const moreController = useRef<AbortController | null>(null);

  const read = useCallback(
    (page: number, signal: AbortSignal) =>
      client.get('/screens', {
        query: {
          applicationId: applicationId ?? 0,
          page,
          pageSize: SCREEN_PAGE_SIZE,
          sort: 'name',
          ...(search !== '' && { q: search }),
        },
        signal,
      }),
    [client, applicationId, search],
  );

  useEffect(() => {
    if (!enabled || applicationId === null) return;
    const controller = new AbortController();
    read(1, controller.signal).then(
      ({ body }) => {
        if (controller.signal.aborted) return;
        setLoaded({ key, items: body.data, page: 1, total: body.total });
        setFailure(null);
        setMoreFailed(false);
      },
      (thrown: unknown) => {
        if (controller.signal.aborted) return;
        setFailure({
          key,
          error: isApiError(thrown)
            ? thrown
            : new ApiError({ status: 0, code: 'UNEXPECTED_RESPONSE' }),
        });
      },
    );
    return () => {
      controller.abort();
      moreController.current?.abort();
    };
  }, [key, enabled, applicationId, read]);

  const current = loaded?.key === key ? loaded : null;

  const loadMore = useCallback(() => {
    if (current === null || loadingMore) return;
    const controller = new AbortController();
    moreController.current = controller;
    setLoadingMore(true);
    setMoreFailed(false);
    read(current.page + 1, controller.signal).then(
      ({ body }) => {
        if (controller.signal.aborted) return;
        setLoaded((previous) =>
          previous?.key === key
            ? {
                key,
                page: previous.page + 1,
                total: body.total,
                items: [
                  ...previous.items,
                  ...body.data.filter((row) => !previous.items.some((item) => item.id === row.id)),
                ],
              }
            : previous,
        );
        setLoadingMore(false);
      },
      () => {
        if (controller.signal.aborted) return;
        setMoreFailed(true);
        setLoadingMore(false);
      },
    );
  }, [current, key, loadingMore, read]);

  return {
    status:
      current !== null
        ? ('ready' as const)
        : failure?.key === key
          ? ('error' as const)
          : ('loading' as const),
    items: current?.items ?? [],
    total: current?.total ?? 0,
    error: failure?.key === key ? failure.error : null,
    hasMore: current !== null && current.items.length < current.total,
    loadingMore,
    moreFailed,
    loadMore,
  };
}
