// useApiResource: result states, reload, abort on unmount and the race between two loads (a slow answer of an
// old key never replaces the answer of the current one).
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { useApiResource, type ResourceAnswer } from '../../api/useApiResource';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  signal: AbortSignal;
}

function deferred<T>(signal: AbortSignal): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject, signal };
}

const answer = <T,>(body: T, etag: string | null = null): ResourceAnswer<T> => ({ body, etag });

describe('useApiResource', () => {
  it('starts loading and then exposes the data and the etag', async () => {
    const { result } = renderHook(() =>
      useApiResource('a', () => Promise.resolve(answer('one', 'W/"1"'))),
    );

    expect(result.current.status).toBe('loading');
    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data).toBe('one');
    expect(result.current.etag).toBe('W/"1"');
    expect(result.current.loading).toBe(false);
  });

  it('exposes the ApiError of a failed load', async () => {
    const failure = new ApiError({ status: 404, code: 'NOT_FOUND' });
    const { result } = renderHook(() => useApiResource('a', () => Promise.reject(failure)));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error).toBe(failure);
  });

  it('turns anything else that is thrown into UNEXPECTED_RESPONSE', async () => {
    const { result } = renderHook(() =>
      useApiResource('a', () => Promise.reject(new Error('boom'))),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error?.code).toBe('UNEXPECTED_RESPONSE');
  });

  it('loads again on reload', async () => {
    const fetcher = vi.fn(() => Promise.resolve(answer('x')));
    const { result } = renderHook(() => useApiResource('a', fetcher));
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    act(() => {
      result.current.reload();
    });

    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('stays idle while disabled', () => {
    const fetcher = vi.fn(() => Promise.resolve(answer('x')));
    const { result } = renderHook(() => useApiResource('a', fetcher, false));

    expect(result.current.status).toBe('loading');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('aborts the request in flight when the component unmounts', () => {
    const calls: Array<Deferred<ResourceAnswer<string>>> = [];
    const { unmount } = renderHook(() =>
      useApiResource('a', (signal) => {
        const call = deferred<ResourceAnswer<string>>(signal);
        calls.push(call);
        return call.promise;
      }),
    );

    expect(calls[0]?.signal.aborted).toBe(false);
    unmount();

    expect(calls[0]?.signal.aborted).toBe(true);
  });

  it('never lets a slow answer of a previous key replace the current one', async () => {
    const calls = new Map<string, Deferred<ResourceAnswer<string>>>();
    function Probe({ filter }: { filter: string }) {
      const resource = useApiResource(filter, (signal) => {
        const call = deferred<ResourceAnswer<string>>(signal);
        calls.set(filter, call);
        return call.promise;
      });
      return (
        <p>
          {resource.status}:{resource.data ?? 'none'}
        </p>
      );
    }

    const { rerender } = render(<Probe filter="old" />);
    rerender(<Probe filter="new" />);
    const oldCall = calls.get('old');
    const newCall = calls.get('new');
    expect(oldCall?.signal.aborted).toBe(true);

    // The current filter answers first, then the old one arrives late.
    await act(async () => {
      newCall?.resolve(answer('new rows'));
      await newCall?.promise;
    });
    await act(async () => {
      oldCall?.resolve(answer('old rows'));
      await oldCall?.promise;
    });

    expect(screen.getByText('ready:new rows')).toBeInTheDocument();
    expect(screen.queryByText(/old rows/)).not.toBeInTheDocument();
  });

  it('ignores a late failure of a previous key too', async () => {
    const calls = new Map<string, Deferred<ResourceAnswer<string>>>();
    function Probe({ filter }: { filter: string }) {
      const resource = useApiResource(filter, (signal) => {
        const call = deferred<ResourceAnswer<string>>(signal);
        calls.set(filter, call);
        return call.promise;
      });
      return <p>{resource.status}</p>;
    }

    const { rerender } = render(<Probe filter="old" />);
    rerender(<Probe filter="new" />);

    await act(async () => {
      calls.get('new')?.resolve(answer('ok'));
      await calls.get('new')?.promise;
    });
    await act(async () => {
      calls.get('old')?.reject(new ApiError({ status: 500, code: 'INTERNAL_ERROR' }));
      await calls.get('old')?.promise.catch(() => undefined);
    });

    expect(screen.getByText('ready')).toBeInTheDocument();
  });
});
