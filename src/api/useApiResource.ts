// useApiResource: loads one read (GET) for a component and keeps its result.
// useApiResource(key, fetcher, enabled = true) -> { status, data, etag, error, loading, reload }
//   key      string that identifies the request (the serialized parameters). A new key starts a new load.
//   fetcher  (signal) => Promise<{ body, etag }>; the latest function is used, it need not be memoized.
//   enabled  false keeps the hook idle (loading stays true until it is enabled).
// Races: each load owns an AbortController. A change of key, a reload or an unmount aborts the load in flight, and
// its answer is discarded if it still arrives, so a slow answer of a previous filter never replaces the current one.
// `data` is the last answer received, also while a new load runs (`loading` tells it apart), so a list can stay on
// screen without flashing; use `status` for the first load and for failures.
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, isApiError } from './ApiError';

export interface ResourceAnswer<T> {
  body: T;
  etag: string | null;
}

export interface ApiResource<T> {
  /** 'loading' until the answer of the current key arrives, then 'ready' or 'error'. */
  status: 'loading' | 'ready' | 'error';
  data: T | null;
  etag: string | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

interface Settled<T> {
  requestKey: string;
  data: T | null;
  etag: string | null;
  error: ApiError | null;
}

export function useApiResource<T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<ResourceAnswer<T>>,
  enabled = true,
): ApiResource<T> {
  const [tick, setTick] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const fetcherRef = useRef(fetcher);
  const requestKey = `${key}#${tick}`;

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetcherRef.current(controller.signal).then(
      (answer) => {
        if (controller.signal.aborted) return;
        setSettled({ requestKey, data: answer.body, etag: answer.etag, error: null });
      },
      (thrown: unknown) => {
        if (controller.signal.aborted) return;
        const error = isApiError(thrown)
          ? thrown
          : new ApiError({ status: 0, code: 'UNEXPECTED_RESPONSE' });
        setSettled((previous) => ({
          requestKey,
          data: previous?.data ?? null,
          etag: null,
          error,
        }));
      },
    );
    return () => {
      controller.abort();
    };
  }, [requestKey, enabled]);

  const reload = useCallback(() => {
    setTick((current) => current + 1);
  }, []);

  const current = enabled && settled?.requestKey === requestKey ? settled : null;
  return {
    status: current === null ? 'loading' : current.error ? 'error' : 'ready',
    data: settled?.data ?? null,
    etag: current?.etag ?? null,
    error: current?.error ?? null,
    loading: current === null,
    reload,
  };
}
