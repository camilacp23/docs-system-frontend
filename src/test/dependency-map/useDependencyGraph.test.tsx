// useDependencyGraph: the answer keeps the SAME object while the ETag does not change (a reload that gets the same graph
// does not make the page place the map again), and a new ETag brings a new object; the request follows the filters and
// the focus; nothing from another request is shown.
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '../../api/client';
import { ApiContext } from '../../api/useApi';
import type { GraphData } from '../../modules/dependency-map/graphTypes';
import { parseGraphParams } from '../../modules/dependency-map/useGraphParams';
import { useDependencyGraph } from '../../modules/dependency-map/useDependencyGraph';
import { sampleGraph } from '../helpers/graphFixtures';

function fakeClient(answers: Array<{ data: GraphData; etag: string }>) {
  let call = 0;
  const get = vi.fn(() => {
    const answer = answers[Math.min(call, answers.length - 1)];
    call += 1;
    // A new object every time, as a parsed response is.
    return Promise.resolve({
      body: { data: JSON.parse(JSON.stringify(answer?.data)) as GraphData },
      etag: answer?.etag ?? null,
      status: 200,
      location: null,
    });
  });
  return { get, client: { get } as unknown as ApiClient };
}

function setup(client: ApiClient, query = '', applicationId: number | null = 1) {
  const params = parseGraphParams(new URLSearchParams(query));
  return renderHook(() => useDependencyGraph({ applicationId, params }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ApiContext value={client}>{children}</ApiContext>
    ),
  });
}

describe('useDependencyGraph', () => {
  it('keeps the same object for the same ETag, also after a reload', async () => {
    const { client, get } = fakeClient([
      { data: sampleGraph(), etag: 'W/"a"' },
      { data: sampleGraph(), etag: 'W/"a"' },
    ]);
    const { result } = setup(client);
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
    const first = result.current.data;

    act(() => {
      result.current.resource.reload();
    });
    await waitFor(() => {
      expect(get).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(result.current.resource.loading).toBe(false);
    });

    expect(result.current.data).toBe(first);
  });

  it('gives a new object when the ETag changes', async () => {
    const { client, get } = fakeClient([
      { data: sampleGraph(), etag: 'W/"a"' },
      { data: sampleGraph(), etag: 'W/"b"' },
    ]);
    const { result } = setup(client);
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
    const first = result.current.data;

    act(() => {
      result.current.resource.reload();
    });
    await waitFor(() => {
      expect(get).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(result.current.data).not.toBe(first);
    });
    expect(result.current.data).toEqual(first);
  });

  it('asks for the graph with the application and the filters, or for the neighborhood with the depth', async () => {
    const full = fakeClient([{ data: sampleGraph(), etag: 'W/"a"' }]);
    const view = setup(full.client, 'view=all&types=SCREEN,VARIABLE&environment=PROD', 7);
    await waitFor(() => {
      expect(view.result.current.data).not.toBeNull();
    });
    expect(full.get).toHaveBeenCalledWith('/dependencies/graph', {
      query: { applicationId: 7, types: ['SCREEN', 'VARIABLE'], environment: 'PROD' },
      signal: expect.any(AbortSignal) as AbortSignal,
    });

    const focused = fakeClient([{ data: sampleGraph(), etag: 'W/"n"' }]);
    const other = setup(focused.client, 'focus=collection:21&depth=2&types=SCREEN');
    await waitFor(() => {
      expect(other.result.current.data).not.toBeNull();
    });
    // The focus asks for no application and no filters: the contract takes none there.
    expect(focused.get).toHaveBeenCalledWith('/dependencies/{type}/{id}', {
      path: { type: 'collections', id: 21 },
      query: { depth: 2 },
      signal: expect.any(AbortSignal) as AbortSignal,
    });
  });

  it('asks for nothing until there is an application (or a focus)', () => {
    const { client, get } = fakeClient([{ data: sampleGraph(), etag: 'W/"a"' }]);
    const { result } = setup(client, '', null);

    expect(get).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });
});
