// API client: Bearer token, single refresh + single retry, no refresh for login, error shape.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { createApiClient } from '../../api/client';
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

describe('api client', () => {
  it('sends the access token as a Bearer header', async () => {
    const { backend, manager, api } = setup();
    await manager.login('ana.mora@dept.local', 'right-password');
    await api.get('/applications');
    const call = backend.calls.find((c) => c.path === '/applications');
    expect(call?.authorization).toBe(`Bearer ${backend.lastToken}`);
  });

  it('refreshes once and retries once after a TOKEN_EXPIRED 401', async () => {
    const { backend, manager, api } = setup();
    await manager.login('ana.mora@dept.local', 'right-password');
    backend.expireAllTokens();
    await api.get('/applications');
    expect(backend.count('/auth/refresh')).toBe(1);
    expect(backend.count('/applications')).toBe(2);
    const retry = backend.calls.filter((c) => c.path === '/applications')[1];
    expect(retry?.authorization).toBe(`Bearer ${backend.lastToken}`);
  });

  it('shares one refresh among simultaneous 401 responses', async () => {
    const { backend, manager, api } = setup(new FakeBackend({ latencyMs: 5 }));
    await manager.login('ana.mora@dept.local', 'right-password');
    backend.expireAllTokens();
    const results = await Promise.all([
      api.get('/applications'),
      api.get('/applications'),
      api.get('/applications'),
    ]);
    expect(results).toHaveLength(3);
    expect(backend.count('/auth/refresh')).toBe(1);
    expect(backend.maxConcurrentRefresh).toBe(1);
  });

  it('does not refresh for the 401 of the login itself', async () => {
    const { backend, manager } = setup();
    await expect(manager.login('ana.mora@dept.local', 'wrong')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    expect(backend.count('/auth/refresh')).toBe(0);
    expect(manager.getSnapshot().status).toBe('initializing');
  });

  it('does not retry the refresh itself and ends the session on REFRESH_INVALID', async () => {
    const { backend, manager, api } = setup();
    await manager.login('ana.mora@dept.local', 'right-password');
    backend.expireAllTokens();
    backend.refreshFailure = { status: 401, code: 'REFRESH_INVALID' };
    await expect(api.get('/applications')).rejects.toMatchObject({ code: 'REFRESH_INVALID' });
    expect(backend.count('/auth/refresh')).toBe(1);
    expect(manager.getSnapshot()).toMatchObject({
      status: 'anonymous',
      endReason: 'revoked',
      phase: 'expired',
    });
    expect(manager.getAccessToken()).toBeNull();
  });

  it('ends the session when the retried call is rejected again', async () => {
    const { backend, manager, api } = setup();
    await manager.login('ana.mora@dept.local', 'right-password');
    // The refreshed token is rejected too (for example a deactivated user).
    vi.spyOn(manager, 'refreshAfterUnauthorized').mockResolvedValue('at-unknown');
    backend.expireAllTokens();
    await expect(api.get('/applications')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(manager.getSnapshot()).toMatchObject({ status: 'anonymous', endReason: 'revoked' });
  });

  it('exposes retryAfterSeconds and the request id of a 429', async () => {
    const { backend, manager } = setup();
    backend.refreshFailure = {
      status: 429,
      code: 'RATE_LIMITED',
      headers: { 'Retry-After': '900', 'X-Request-Id': 'req-9' },
    };
    await manager.bootstrap();
    const error = manager.getSnapshot().bootstrapError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterSeconds: 900,
      requestId: 'req-9',
    });
    expect(error?.details).toEqual({ minutes: 15 });
    expect(manager.getSnapshot().status).toBe('unavailable');
  });

  it('turns a failed fetch and a non-JSON body into ApiError', async () => {
    const { manager, api } = setup();
    await manager.login('ana.mora@dept.local', 'right-password');
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.get('/applications')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<html>Bad gateway</html>', { status: 502 }),
    );
    await expect(api.get('/applications')).rejects.toMatchObject({
      status: 502,
      code: 'UNEXPECTED_RESPONSE',
    });
  });

  it('takes the request id from the body details of an INTERNAL_ERROR', async () => {
    const { manager, api } = setup();
    await manager.login('ana.mora@dept.local', 'right-password');
    const body = { code: 'INTERNAL_ERROR', message: 'x', details: { requestId: '7f3c2a' } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status: 500, headers: { 'X-Request-Id': 'header-id' } }),
    );
    await expect(api.get('/applications')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      requestId: '7f3c2a',
    });
  });

  it('sends If-Match, the JSON body and credentials same-origin', async () => {
    const { manager, api } = setup();
    await manager.login('ana.mora@dept.local', 'right-password');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await api
      .put('/applications/{id}', {
        path: { id: 3 },
        ifMatch: 'W/"1"',
        body: { name: 'SAR', platform: 'Power Apps', status: 'ACTIVE' },
      })
      .catch(() => undefined);
    const [url, init] = fetchSpy.mock.calls.at(-1) ?? [];
    expect(url).toBe('/api/v1/applications/3');
    expect(init?.credentials).toBe('same-origin');
    expect(new Headers(init?.headers).get('If-Match')).toBe('W/"1"');
    expect(init?.body).toBe(
      JSON.stringify({ name: 'SAR', platform: 'Power Apps', status: 'ACTIVE' }),
    );
  });
});

beforeEach(() => {
  localStorage.clear();
});
