// useReviewQueue: the screens waiting for a decision in the selected application (S-36).
// useReviewQueue(applicationId) -> { status, rows, total, error, loadingMore, moreFailed, hasMore, loadMore, refresh,
//   remove(id) }
// GET /screens with documentationStatus=IN_REVIEW and sort=updatedAt (ascending: the one waiting longest first, D-142), 20
// per page, App (OnStart) first as the API always lists it. "Load more" reads the next page and appends it.
//   remove(id)  takes a decided screen out of the list at once (the decision already succeeded)
//   refresh()   reads the pages shown again, from the server's copy (after a refusal, or when the tab is visible again)
// A decision shifts the pages of the server (the screen is no longer in review), so the next "Load more" after a removal
// first reads again the pages already shown plus the next one in a single pass; otherwise it just reads the next page. A
// row is never listed twice. The list is kept while it is read again (no flicker); `status` tells the first load apart.
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError } from '../../api/ApiError';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import type { ScreenSummary } from '../screens/screenTypes';

import { REVIEW_PAGE_SIZE } from './reviewModel';

interface Queue {
  rows: ScreenSummary[];
  total: number;
  /** How many pages the rows come from. */
  pages: number;
}

export interface ReviewQueue {
  status: 'loading' | 'ready' | 'error';
  rows: ScreenSummary[];
  total: number;
  error: ApiError | null;
  loadingMore: boolean;
  moreFailed: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  remove: (id: number) => void;
}

const EMPTY: Queue = { rows: [], total: 0, pages: 1 };

export function useReviewQueue(applicationId: number | null): ReviewQueue {
  const client = useApi();
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  // The pages the next full read covers, and whether a removal made the pages of the server drift.
  const plan = useRef({ applicationId, pages: 1, drifted: false });
  const busy = useRef(false);

  const read = useCallback(
    (page: number, signal?: AbortSignal) =>
      client.get('/screens', {
        query: {
          applicationId: applicationId ?? 0,
          documentationStatus: 'IN_REVIEW',
          sort: 'updatedAt',
          page,
          pageSize: REVIEW_PAGE_SIZE,
        },
        signal,
      }),
    [client, applicationId],
  );

  const resource = useApiResource<Queue>(
    `review-queue:${applicationId ?? 'none'}`,
    async (signal) => {
      if (plan.current.applicationId !== applicationId) {
        plan.current = { applicationId, pages: 1, drifted: false };
      }
      const wanted = plan.current.pages;
      const rows: ScreenSummary[] = [];
      let total = 0;
      let pages = 0;
      for (let page = 1; page <= wanted; page += 1) {
        const { body } = await read(page, signal);
        total = body.total;
        pages = page;
        for (const row of body.data) if (!rows.some((known) => known.id === row.id)) rows.push(row);
        if (page * REVIEW_PAGE_SIZE >= body.total) break;
      }
      plan.current = { applicationId, pages, drifted: false };
      return { body: { rows, total, pages }, etag: null };
    },
    applicationId !== null,
  );
  const { apply, reload } = resource;
  const queue = resource.data ?? EMPTY;
  const latest = useRef(queue);
  useEffect(() => {
    latest.current = queue;
  });

  const refresh = useCallback(() => {
    plan.current = { ...plan.current, pages: Math.max(1, latest.current.pages), drifted: false };
    setMoreFailed(false);
    reload();
  }, [reload]);

  const loadMore = useCallback(() => {
    if (busy.current) return;
    const current = latest.current;
    if (plan.current.drifted) {
      // The server's pages moved under the rows shown: read them again together with the next one.
      plan.current = { ...plan.current, pages: current.pages + 1, drifted: false };
      setMoreFailed(false);
      reload();
      return;
    }
    busy.current = true;
    setLoadingMore(true);
    setMoreFailed(false);
    read(current.pages + 1)
      .then(
        ({ body }) => {
          const base = latest.current;
          const rows = [...base.rows];
          for (const row of body.data)
            if (!rows.some((known) => known.id === row.id)) rows.push(row);
          plan.current = { ...plan.current, pages: base.pages + 1 };
          apply({ rows, total: body.total, pages: base.pages + 1 }, null);
        },
        () => {
          setMoreFailed(true);
        },
      )
      .finally(() => {
        busy.current = false;
        setLoadingMore(false);
      });
  }, [read, apply, reload]);

  const remove = useCallback(
    (id: number) => {
      const current = latest.current;
      if (!current.rows.some((row) => row.id === id)) return;
      plan.current = { ...plan.current, drifted: true };
      apply(
        {
          ...current,
          rows: current.rows.filter((row) => row.id !== id),
          total: Math.max(0, current.total - 1),
        },
        null,
      );
    },
    [apply],
  );

  return {
    status: resource.status,
    rows: queue.rows,
    total: queue.total,
    error: resource.error,
    loadingMore,
    moreFailed,
    hasMore: queue.rows.length < queue.total,
    loadMore,
    refresh,
    remove,
  };
}
