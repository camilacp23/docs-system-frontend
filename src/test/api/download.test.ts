// The binary side of the API client (download of a report file): the same Bearer token, the single shared refresh and the
// single retry as every other call, the headers that name the file, and the usual ApiError for an answer that is not 2xx
// (its JSON body is read, so the catalog texts apply).
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { createApiClient } from '../../api/client';
import { rawDownload } from '../../api/http';
import { SessionManager } from '../../session/SessionManager';
import { FakeBackend, FakeLocks } from '../helpers/fakeBackend';

function setup(backend = new FakeBackend()) {
  backend.install();
  const manager = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
  return { backend, manager, api: createApiClient(manager) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api client: download', () => {
  it('sends the access token and resolves with a Blob', async () => {
    const { backend, manager, api } = setup();
    await manager.login('ana.mora@dept.local', 'right-password');

    const file = await api.download('/reports/{id}/file', { path: { id: 12 } });

    const call = backend.calls.find((c) => c.path === '/reports/12/file');
    expect(call?.authorization).toBe(`Bearer ${backend.lastToken}`);
    expect(typeof file.blob.arrayBuffer).toBe('function');
    expect(file.blob.size).toBeGreaterThan(0);
  });

  it('refreshes once and retries once after a TOKEN_EXPIRED 401 during the download', async () => {
    const { backend, manager, api } = setup();
    await manager.login('ana.mora@dept.local', 'right-password');
    backend.expireAllTokens();

    const file = await api.download('/reports/{id}/file', { path: { id: 12 } });

    expect(file.blob.size).toBeGreaterThan(0);
    expect(backend.count('/auth/refresh')).toBe(1);
    const downloads = backend.calls.filter((c) => c.path === '/reports/12/file');
    expect(downloads).toHaveLength(2);
    expect(downloads[1]?.authorization).toBe(`Bearer ${backend.lastToken}`);
  });

  it('shares ONE refresh between a download and a read that fail together', async () => {
    const { backend, manager, api } = setup(new FakeBackend({ latencyMs: 5 }));
    await manager.login('ana.mora@dept.local', 'right-password');
    backend.expireAllTokens();

    await Promise.all([
      api.download('/reports/{id}/file', { path: { id: 12 } }),
      api.get('/applications'),
    ]);

    expect(backend.count('/auth/refresh')).toBe(1);
    expect(backend.maxConcurrentRefresh).toBe(1);
  });

  it('ends the session when the refresh is refused during a download', async () => {
    const { backend, manager, api } = setup();
    await manager.login('ana.mora@dept.local', 'right-password');
    backend.expireAllTokens();
    backend.refreshFailure = { status: 401, code: 'REFRESH_INVALID' };

    await expect(api.download('/reports/{id}/file', { path: { id: 12 } })).rejects.toMatchObject({
      code: 'REFRESH_INVALID',
    });
    expect(backend.count('/auth/refresh')).toBe(1);
  });
});

describe('rawDownload', () => {
  function answer(response: Response) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  }

  it('returns the headers that name the file', async () => {
    const spy = answer(
      new Response('%PDF', {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="doc-2026-10-05.pdf"',
          ETag: 'W/"5"',
        },
      }),
    );

    const file = await rawDownload({
      method: 'GET',
      path: '/reports/{id}/file',
      pathParams: { id: 3 },
      token: 't',
    });

    expect(file.contentType).toBe('application/pdf');
    expect(file.contentDisposition).toBe('attachment; filename="doc-2026-10-05.pdf"');
    expect(file.etag).toBe('W/"5"');
    expect(await file.blob.text()).toBe('%PDF');
    const [url, init] = spy.mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/reports/3/file');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer t');
    expect((init?.headers as Record<string, string>).Accept).toContain('application/pdf');
  });

  it('turns a 409 JSON body into an ApiError with its code and details', async () => {
    answer(
      new Response(
        JSON.stringify({
          code: 'REPORT_NOT_READY',
          message: 'server text',
          details: { status: 'PENDING' },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req-1' } },
      ),
    );

    const failure = await rawDownload({
      method: 'GET',
      path: '/reports/{id}/file',
      pathParams: { id: 3 },
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      status: 409,
      code: 'REPORT_NOT_READY',
      details: { status: 'PENDING' },
      requestId: 'req-1',
    });
  });

  it('turns an answer that is not the error format into UNEXPECTED_RESPONSE', async () => {
    answer(new Response('<html>Bad gateway</html>', { status: 502 }));

    await expect(
      rawDownload({ method: 'GET', path: '/reports/{id}/file', pathParams: { id: 3 } }),
    ).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE', status: 502 });
  });

  it('turns a failed fetch into NETWORK_ERROR and lets an abort through', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(
      rawDownload({ method: 'GET', path: '/reports/{id}/file', pathParams: { id: 3 } }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    await expect(
      rawDownload({ method: 'GET', path: '/reports/{id}/file', pathParams: { id: 3 } }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
