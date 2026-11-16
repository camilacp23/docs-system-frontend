// useComments: the thread of a screen (GET /screens/{id}/comments), read from the newest end (D-144).
// useComments(screenId, expectedCount) -> { status, items, total, error, earlierLeft, earlierCount, loadingEarlier,
//   earlierFailed, reload, loadEarlier, append(comment, etag), replace(comment, etag), etagOf(comment) }
//   items      the loaded comments, oldest first (the order of the API), always a contiguous run that ends at the newest
//   total      what the API says there are, plus the comments written here since
// Pages are 50 comments. The first read asks for the last page computed from `expectedCount` (the detail's
// commentCount), so a thread of any size costs one request. If the API's `total` says the last page is another one (a
// comment arrived between the detail and the thread), the right page is read instead. "Load earlier comments" reads the
// page before the first one loaded and puts it above. Nothing is polled: a comment by someone else shows when the tab is
// opened again or on reload.
// etagOf(comment) is the tag to send as If-Match when editing: the ETag of the last answer for that comment, else the
// formula of D-123 on the comment as listed.
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError } from '../../api/ApiError';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';

import { COMMENT_PAGE_SIZE, commentEtag, lastPageOf } from './commentModel';
import type { ScreenComment } from './commentTypes';

export interface CommentThread {
  status: 'loading' | 'ready' | 'error';
  items: ScreenComment[];
  total: number;
  error: ApiError | null;
  earlierLeft: boolean;
  earlierCount: number;
  loadingEarlier: boolean;
  earlierFailed: boolean;
  reload: () => void;
  loadEarlier: () => void;
  append: (comment: ScreenComment, etag: string | null) => void;
  replace: (comment: ScreenComment, etag: string | null) => void;
  etagOf: (comment: ScreenComment) => string;
}

interface Loaded {
  items: ScreenComment[];
  total: number;
  firstPage: number;
}

const EMPTY: Loaded = { items: [], total: 0, firstPage: 1 };

export function useComments(screenId: number, expectedCount: number): CommentThread {
  const client = useApi();
  const expected = useRef(expectedCount);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [earlierFailed, setEarlierFailed] = useState(false);
  const [etags, setEtags] = useState<Record<number, string>>({});
  const busyEarlier = useRef(false);

  useEffect(() => {
    expected.current = expectedCount;
  });

  const resource = useApiResource<Loaded>(`comments:${screenId}`, async (signal) => {
    const read = (page: number) =>
      client.get('/screens/{id}/comments', {
        path: { id: screenId },
        query: { page, pageSize: COMMENT_PAGE_SIZE },
        signal,
      });
    let page = lastPageOf(expected.current);
    let answer = await read(page);
    const real = lastPageOf(answer.body.total);
    if (real !== page) {
      // The thread has grown (or shrunk) since the detail was read: the newest comments are on another page.
      page = real;
      answer = await read(page);
    }
    return {
      body: { items: answer.body.data, total: answer.body.total, firstPage: page },
      etag: null,
    };
  });
  const { apply, reload: reloadResource } = resource;
  const loaded = resource.data ?? EMPTY;
  const latest = useRef(loaded);
  useEffect(() => {
    latest.current = loaded;
  });

  const reload = useCallback(() => {
    setEtags({});
    setEarlierFailed(false);
    reloadResource();
  }, [reloadResource]);

  const loadEarlier = useCallback(() => {
    if (busyEarlier.current) return;
    const page = latest.current.firstPage - 1;
    if (page < 1) return;
    busyEarlier.current = true;
    setLoadingEarlier(true);
    setEarlierFailed(false);
    client
      .get('/screens/{id}/comments', {
        path: { id: screenId },
        query: { page, pageSize: COMMENT_PAGE_SIZE },
      })
      .then(
        (answer) => {
          const current = latest.current;
          const known = new Set(current.items.map((item) => item.id));
          const older = answer.body.data.filter((item) => !known.has(item.id));
          apply({ ...current, items: [...older, ...current.items], firstPage: page }, null);
        },
        () => {
          setEarlierFailed(true);
        },
      )
      .finally(() => {
        busyEarlier.current = false;
        setLoadingEarlier(false);
      });
  }, [client, screenId, apply]);

  const append = useCallback(
    (comment: ScreenComment, etag: string | null) => {
      const current = latest.current;
      apply({ ...current, items: [...current.items, comment], total: current.total + 1 }, null);
      if (etag !== null) setEtags((previous) => ({ ...previous, [comment.id]: etag }));
    },
    [apply],
  );

  const replace = useCallback(
    (comment: ScreenComment, etag: string | null) => {
      const current = latest.current;
      apply(
        {
          ...current,
          items: current.items.map((item) => (item.id === comment.id ? comment : item)),
        },
        null,
      );
      if (etag !== null) setEtags((previous) => ({ ...previous, [comment.id]: etag }));
    },
    [apply],
  );

  const etagOf = useCallback(
    (comment: ScreenComment) => etags[comment.id] ?? commentEtag(comment),
    [etags],
  );

  return {
    status: resource.status,
    items: loaded.items,
    total: loaded.total,
    error: resource.error,
    earlierLeft: loaded.firstPage > 1,
    earlierCount: Math.max(0, loaded.total - loaded.items.length),
    loadingEarlier,
    earlierFailed,
    reload,
    loadEarlier,
    append,
    replace,
    etagOf,
  };
}
