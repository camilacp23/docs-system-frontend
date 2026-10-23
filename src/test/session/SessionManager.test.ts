// SessionManager: bootstrap, token storage, end-of-session timers, tab coordination (R-4), logout.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../api/client';
import { ENDING_SOON_MS, SessionManager } from '../../session/SessionManager';
import { FakeBackend, FakeChannelBus, FakeLocks, TEST_USER } from '../helpers/fakeBackend';

const EMAIL = 'ana.mora@dept.local';
const PASSWORD = 'right-password';

function tab(locks: FakeLocks, bus: FakeChannelBus) {
  const manager = new SessionManager({ lock: locks, createChannel: bus.create });
  manager.start();
  return { manager, api: createApiClient(manager) };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('bootstrap', () => {
  it('recovers the session with the refresh cookie', async () => {
    new FakeBackend().install();
    // The fake knows only cookies it issued: log in once, then simulate a reload with a new manager.
    const first = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
    await first.login(EMAIL, PASSWORD);
    const reloaded = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
    await reloaded.bootstrap();
    expect(reloaded.getSnapshot()).toMatchObject({
      status: 'authenticated',
      role: 'DEVELOPER',
      phase: 'active',
    });
    expect(reloaded.getSnapshot().user).toEqual(TEST_USER);
  });

  it('is anonymous when there is no session (REFRESH_INVALID)', async () => {
    new FakeBackend().install();
    const manager = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
    await manager.bootstrap();
    expect(manager.getSnapshot()).toMatchObject({
      status: 'anonymous',
      endReason: null,
      bootstrapError: null,
    });
  });

  it('is unavailable on a network failure and can retry', async () => {
    const spy = new FakeBackend().install();
    spy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const manager = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
    await manager.bootstrap();
    expect(manager.getSnapshot().status).toBe('unavailable');
    expect(manager.getSnapshot().bootstrapError?.code).toBe('NETWORK_ERROR');
    await manager.retryBootstrap();
    expect(manager.getSnapshot().status).toBe('anonymous');
  });
});

describe('token storage', () => {
  it('never writes the access token to localStorage, sessionStorage or cookies', async () => {
    const backend = new FakeBackend();
    backend.install();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const manager = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
    await manager.login(EMAIL, PASSWORD);
    backend.expireAllTokens();
    await createApiClient(manager).get('/applications');
    const token = manager.getAccessToken();
    expect(token).toBeTruthy();
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).not.toContain(token ?? 'x');
  });
});

describe('end of session', () => {
  it('goes endingSoon 10 minutes before the end and expired at the end', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-20T08:00:00Z') });
    new FakeBackend({ sessionExpiresIn: 3600 }).install();
    const manager = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
    manager.start();
    await manager.login(EMAIL, PASSWORD);
    expect(manager.getSnapshot().phase).toBe('active');

    await vi.advanceTimersByTimeAsync(3600_000 - ENDING_SOON_MS - 1000);
    expect(manager.getSnapshot().phase).toBe('active');
    await vi.advanceTimersByTimeAsync(1000);
    expect(manager.getSnapshot().phase).toBe('endingSoon');

    await vi.advanceTimersByTimeAsync(ENDING_SOON_MS - 1000);
    expect(manager.getSnapshot().status).toBe('authenticated');
    await vi.advanceTimersByTimeAsync(1000);
    expect(manager.getSnapshot()).toMatchObject({
      status: 'anonymous',
      phase: 'expired',
      endReason: 'expired',
    });
    expect(manager.getSnapshot().lastUser).toEqual(TEST_USER);
    expect(manager.getAccessToken()).toBeNull();
    manager.stop();
  });

  it('starts endingSoon when fewer than 10 minutes are left on arrival', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-20T08:00:00Z') });
    new FakeBackend({ sessionExpiresIn: 300 }).install();
    const manager = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
    manager.start();
    await manager.login(EMAIL, PASSWORD);
    expect(manager.getSnapshot().phase).toBe('endingSoon');
    expect(manager.getSnapshot().endsAt).toBe(Date.now() + 300_000);
    manager.stop();
  });

  it('notifies subscribers on each change', async () => {
    new FakeBackend().install();
    const manager = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
    const listener = vi.fn();
    manager.subscribe(listener);
    await manager.login(EMAIL, PASSWORD);
    expect(listener).toHaveBeenCalled();
  });
});

describe('logout', () => {
  it('calls POST /auth/logout, clears the session and tells the other tabs', async () => {
    const backend = new FakeBackend();
    backend.install();
    const locks = new FakeLocks();
    const bus = new FakeChannelBus();
    const a = tab(locks, bus);
    const b = tab(locks, bus);
    await a.manager.login(EMAIL, PASSWORD);
    await tick();
    expect(b.manager.getSnapshot().status).toBe('authenticated');

    await a.manager.logout();
    await tick();
    expect(a.manager.getSnapshot()).toMatchObject({
      status: 'anonymous',
      endReason: 'logout',
      user: null,
      lastUser: null,
    });
    expect(b.manager.getSnapshot()).toMatchObject({ status: 'anonymous', endReason: 'logout' });
    expect(backend.count('/auth/logout')).toBe(1); // the other tab does not call the API again
    a.manager.stop();
    b.manager.stop();
  });

  it('clears the session even when the call fails, and rethrows', async () => {
    const spy = new FakeBackend().install();
    const manager = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
    await manager.login(EMAIL, PASSWORD);
    spy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(manager.logout()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(manager.getSnapshot().status).toBe('anonymous');
  });

  it('discards a refresh that answers after the logout', async () => {
    new FakeBackend({ latencyMs: 10 }).install();
    // Without a lock the logout does not wait for the refresh, so the refresh answers after it.
    const manager = new SessionManager({ lock: null, createChannel: () => null });
    await manager.login(EMAIL, PASSWORD);
    const refresh = manager.refreshAfterUnauthorized(manager.getAccessToken());
    const rejected = expect(refresh).rejects.toMatchObject({ code: 'REFRESH_INVALID' });
    await tick();
    await manager.logout();
    await rejected;
    expect(manager.getSnapshot().status).toBe('anonymous');
    expect(manager.getAccessToken()).toBeNull();
  });
});

describe('tabs (R-4)', () => {
  it('two tabs whose tokens expire at once refresh in series and keep the session', async () => {
    const backend = new FakeBackend({ latencyMs: 5 });
    backend.install();
    const locks = new FakeLocks();
    const bus = new FakeChannelBus();
    const a = tab(locks, bus);
    const b = tab(locks, bus);
    await a.manager.login(EMAIL, PASSWORD);
    await tick();
    expect(b.manager.getSnapshot().status).toBe('authenticated');

    backend.expireAllTokens();
    const refreshesBefore = backend.refreshCount;
    await Promise.all([a.api.get('/applications'), b.api.get('/applications')]);

    expect(backend.maxConcurrentRefresh).toBe(1);
    expect(locks.maxHeld).toBe(1);
    expect(backend.refreshCount - refreshesBefore).toBe(1); // the second tab used the session the first one shared
    expect(a.manager.getSnapshot().status).toBe('authenticated');
    expect(b.manager.getSnapshot().status).toBe('authenticated');
    expect(b.manager.getAccessToken()).toBe(a.manager.getAccessToken());
    a.manager.stop();
    b.manager.stop();
  });

  it('two tabs loading at once never send the refresh in parallel', async () => {
    const backend = new FakeBackend({ latencyMs: 5 });
    backend.install();
    const seed = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
    await seed.login(EMAIL, PASSWORD);

    const locks = new FakeLocks();
    const bus = new FakeChannelBus();
    const a = tab(locks, bus); // start() runs the bootstrap refresh of both tabs at the same time
    const b = tab(locks, bus);
    await Promise.all([a.manager.bootstrap(), b.manager.bootstrap()]);

    expect(backend.maxConcurrentRefresh).toBe(1);
    expect(a.manager.getSnapshot().status).toBe('authenticated');
    expect(b.manager.getSnapshot().status).toBe('authenticated');
    a.manager.stop();
    b.manager.stop();
  });

  it('without Web Locks each tab still keeps one refresh in flight', async () => {
    const backend = new FakeBackend({ latencyMs: 5 });
    backend.install();
    const manager = new SessionManager({ lock: null, createChannel: () => null });
    await manager.login(EMAIL, PASSWORD);
    backend.expireAllTokens();
    const token = manager.getAccessToken();
    await Promise.all([
      manager.refreshAfterUnauthorized(token),
      manager.refreshAfterUnauthorized(token),
    ]);
    expect(backend.refreshCount).toBe(1);
  });

  it('a new tab receives the session from a tab that already has one', async () => {
    const backend = new FakeBackend();
    backend.install();
    const locks = new FakeLocks();
    const bus = new FakeChannelBus();
    const a = tab(locks, bus);
    await a.manager.login(EMAIL, PASSWORD);
    const b = tab(locks, bus);
    await b.manager.bootstrap();
    expect(b.manager.getSnapshot().status).toBe('authenticated');
    a.manager.stop();
    b.manager.stop();
  });

  it('a revoked session ends in every tab', async () => {
    const backend = new FakeBackend();
    backend.install();
    const locks = new FakeLocks();
    const bus = new FakeChannelBus();
    const a = tab(locks, bus);
    const b = tab(locks, bus);
    await a.manager.login(EMAIL, PASSWORD);
    await tick();
    backend.expireAllTokens();
    backend.refreshFailure = { status: 401, code: 'REFRESH_INVALID' };
    await expect(a.api.get('/applications')).rejects.toMatchObject({ code: 'REFRESH_INVALID' });
    await tick();
    expect(a.manager.getSnapshot().endReason).toBe('revoked');
    expect(b.manager.getSnapshot().endReason).toBe('revoked');
    a.manager.stop();
    b.manager.stop();
  });
});
