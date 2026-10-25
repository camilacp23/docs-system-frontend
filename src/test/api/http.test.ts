// HTTP layer: fetch cache option (GET only), ETag reading for If-Match, 304 never an error.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { isApiError } from '../../api/ApiError';
import { createApiClient, type SessionPort } from '../../api/client';
import { rawRequest } from '../../api/http';

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function mockFetch(...responses: Response[]) {
  const spy = vi.spyOn(globalThis, 'fetch');
  for (const response of responses) spy.mockResolvedValueOnce(response);
  return spy;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetch cache option', () => {
  it("sends cache: 'no-cache' in GET requests", async () => {
    const spy = mockFetch(json({ data: [] }));
    await rawRequest({ method: 'GET', path: '/variables' });
    expect(spy.mock.calls[0]?.[1]?.cache).toBe('no-cache');
  });

  it('does not send the option in writes', async () => {
    const spy = mockFetch(
      json({ id: 1 }, 201),
      json({ id: 1 }),
      new Response(null, { status: 204 }),
    );
    await rawRequest({ method: 'POST', path: '/variables', body: { name: 'a' } });
    await rawRequest({ method: 'PUT', path: '/variables/{id}', pathParams: { id: 1 }, body: {} });
    await rawRequest({ method: 'DELETE', path: '/variables/{id}', pathParams: { id: 1 } });
    expect(spy.mock.calls).toHaveLength(3);
    for (const [, init] of spy.mock.calls) {
      expect(init).not.toHaveProperty('cache');
    }
  });

  it('is sent by the authenticated client in GET and not in PUT', async () => {
    const port: SessionPort = {
      getAccessToken: () => 'token',
      refreshAfterUnauthorized: () => Promise.reject(new Error('unused')),
      endSessionUnauthorized: () => undefined,
    };
    const api = createApiClient(port);
    const spy = mockFetch(json({}), json({}));
    await api.get('/variables/{id}', { path: { id: 1 } });
    await api.put('/variables/{id}', { path: { id: 1 }, ifMatch: 'W/"1"', body: {} as never });
    expect(spy.mock.calls[0]?.[1]?.cache).toBe('no-cache');
    expect(spy.mock.calls[1]?.[1]).not.toHaveProperty('cache');
  });
});

describe('ETag', () => {
  it('reads it in a GET, in a 201 with Location and in the 200 of a PUT', async () => {
    mockFetch(
      json({ data: {} }, 200, { ETag: 'W/"1760000000000"' }),
      json({ data: {} }, 201, { ETag: 'W/"1760000000001"', Location: '/api/v1/variables/9' }),
      json({ data: {} }, 200, { ETag: 'W/"1760000000002"' }),
    );
    const get = await rawRequest({ method: 'GET', path: '/variables/{id}', pathParams: { id: 9 } });
    const post = await rawRequest({ method: 'POST', path: '/variables', body: {} });
    const put = await rawRequest({ method: 'PUT', path: '/variables/{id}', pathParams: { id: 9 } });
    expect(get.etag).toBe('W/"1760000000000"');
    expect(post).toMatchObject({
      status: 201,
      etag: 'W/"1760000000001"',
      location: '/api/v1/variables/9',
    });
    expect(put.etag).toBe('W/"1760000000002"');
    expect([get, post, put].every((r) => !r.notModified)).toBe(true);
  });

  it('is null when the response has no ETag', async () => {
    mockFetch(json({ data: [] }));
    const result = await rawRequest({ method: 'GET', path: '/variables' });
    expect(result.etag).toBeNull();
  });

  it('is sent back as If-Match, and kept in the retry after a refresh', async () => {
    let token = 'old';
    const port: SessionPort = {
      getAccessToken: () => token,
      refreshAfterUnauthorized: () => {
        token = 'new';
        return Promise.resolve('new');
      },
      endSessionUnauthorized: () => undefined,
    };
    const api = createApiClient(port);
    const spy = mockFetch(
      json({ data: {} }, 200, { ETag: 'W/"5"' }),
      json({ code: 'TOKEN_EXPIRED', message: 'x' }, 401),
      json({ data: {} }, 200, { ETag: 'W/"6"' }),
    );
    const read = await api.get('/variables/{id}', { path: { id: 4 } });
    const saved = await api.put('/variables/{id}', {
      path: { id: 4 },
      ifMatch: read.etag ?? undefined,
      body: {} as never,
    });
    const sent = spy.mock.calls.slice(1).map(([, init]) => new Headers(init?.headers));
    expect(sent.map((h) => h.get('If-Match'))).toEqual(['W/"5"', 'W/"5"']);
    expect(sent.map((h) => h.get('Authorization'))).toEqual(['Bearer old', 'Bearer new']);
    expect(saved.etag).toBe('W/"6"');
  });

  it('surfaces currentETag of a 412', async () => {
    mockFetch(
      json(
        {
          code: 'PRECONDITION_FAILED',
          message: 'x',
          details: { element: 'variable', currentETag: 'W/"9"' },
        },
        412,
      ),
    );
    const error = await rawRequest({
      method: 'PUT',
      path: '/variables/{id}',
      pathParams: { id: 4 },
    })
      .then(() => null)
      .catch((e: unknown) => e);
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({
      status: 412,
      code: 'PRECONDITION_FAILED',
      details: { currentETag: 'W/"9"' },
    });
  });
});

describe('304 Not Modified', () => {
  it('is not an error: notModified, null body and the ETag', async () => {
    mockFetch(new Response(null, { status: 304, headers: { ETag: 'W/"3"' } }));
    const result = await rawRequest({
      method: 'GET',
      path: '/variables/{id}',
      pathParams: { id: 3 },
      headers: { 'If-None-Match': 'W/"3"' },
    });
    expect(result).toEqual({
      body: null,
      status: 304,
      etag: 'W/"3"',
      location: null,
      notModified: true,
    });
  });

  it('is not an error without an ETag header either', async () => {
    mockFetch(new Response(null, { status: 304 }));
    const result = await rawRequest({ method: 'GET', path: '/variables' });
    expect(result).toMatchObject({ status: 304, notModified: true, body: null, etag: null });
  });

  it('reaches the authenticated client as a result, without refresh or ApiError', async () => {
    const refresh = vi.fn();
    const api = createApiClient({
      getAccessToken: () => 'token',
      refreshAfterUnauthorized: refresh,
      endSessionUnauthorized: () => undefined,
    });
    mockFetch(new Response(null, { status: 304, headers: { ETag: 'W/"3"' } }));
    const result = await api.get('/variables');
    expect(result).toMatchObject({ status: 304, notModified: true });
    expect(refresh).not.toHaveBeenCalled();
  });
});
