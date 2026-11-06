// useScreen: the read of a screen revalidates with the ETag (D-72). Through the real HTTP layer: the GET goes out
// with cache: 'no-cache' (so the browser revalidates and absorbs a 304), and a raw 304 keeps the copy the hook
// already has; a 304 with nothing to keep is an unexpected answer, never a blank page.
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../api/client';
import { ApiContext } from '../../api/useApi';
import { useScreen } from '../../modules/screens/useScreen';
import { makeScreenDetail } from '../helpers/fakeScreensApi';

const client = createApiClient({
  getAccessToken: () => 'token',
  refreshAfterUnauthorized: () => Promise.reject(new Error('not expected')),
  endSessionUnauthorized: () => undefined,
});
const wrapper = ({ children }: { children: ReactNode }) => (
  <ApiContext value={client}>{children}</ApiContext>
);

const json = (body: unknown, etag: string) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ETag: etag },
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useScreen', () => {
  it('reads the screen revalidating (no-cache) and keeps its ETag', async () => {
    const screen = makeScreenDetail(12, 'Detalle');
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ data: screen }, 'W/"5"'));

    const { result } = renderHook(() => useScreen(12), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data?.name).toBe('Detalle');
    expect(result.current.etag).toBe('W/"5"');
    expect(spy.mock.calls[0]?.[0]).toBe('/api/v1/screens/12');
    expect(spy.mock.calls[0]?.[1]?.cache).toBe('no-cache');
  });

  it('keeps the copy it has when a reload answers 304', async () => {
    const screen = makeScreenDetail(12, 'Detalle');
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ data: screen }, 'W/"5"'))
      .mockResolvedValueOnce(new Response(null, { status: 304, headers: { ETag: 'W/"5"' } }));

    const { result } = renderHook(() => useScreen(12), { wrapper });
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.data?.name).toBe('Detalle');
    expect(result.current.etag).toBe('W/"5"');
  });

  it('takes the new copy when the reload answers 200 with another ETag', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json({ data: makeScreenDetail(12, 'Detalle') }, 'W/"5"'))
      .mockResolvedValueOnce(
        json({ data: makeScreenDetail(12, 'Detalle', { pendingSubtasks: 4 }) }, 'W/"6"'),
      );

    const { result } = renderHook(() => useScreen(12), { wrapper });
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.etag).toBe('W/"6"');
    });
    expect(result.current.data?.pendingSubtasks).toBe(4);
  });

  it('reports an unexpected answer for a 304 with no copy to keep', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 304 }));

    const { result } = renderHook(() => useScreen(12), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error?.code).toBe('UNEXPECTED_RESPONSE');
  });

  it('does not read anything without an id', () => {
    const spy = vi.spyOn(globalThis, 'fetch');

    renderHook(() => useScreen(null), { wrapper });

    expect(spy).not.toHaveBeenCalled();
  });
});
