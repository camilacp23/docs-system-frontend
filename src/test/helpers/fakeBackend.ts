// Test doubles for the session layer: a fake backend behind fetch that rotates the refresh cookie like the real
// one (presenting a rotated cookie again revokes the family), a fake Web Locks, and a fake BroadcastChannel bus.
import { vi } from 'vitest';

import type { components } from '../../api/schema';
import type { ExclusiveLock, SessionChannel } from '../../session/browserApis';

type User = components['schemas']['User'];

export const TEST_USER: User = {
  id: 7,
  name: 'Ana Mora',
  email: 'ana.mora@dept.local',
  role: 'DEVELOPER',
  status: 'ACTIVE',
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export interface BackendOptions {
  /** Seconds left of the session reported by login / refresh. */
  sessionExpiresIn?: number;
  /** Milliseconds each request takes (real timers only). 0 resolves in microtasks. */
  latencyMs?: number;
}

export interface RecordedCall {
  method: string;
  path: string;
  authorization: string | null;
}

export class FakeBackend {
  readonly calls: RecordedCall[] = [];
  /** The cookie jar of the browser, shared by every tab. */
  cookie: string | null = null;
  maxConcurrentRefresh = 0;
  refreshCount = 0;
  sessionExpiresIn: number;
  latencyMs: number;
  /** Set to make /auth/refresh answer a failure instead. */
  refreshFailure: { status: number; code: string; headers?: Record<string, string> } | null = null;

  private seq = 0;
  private validCookie: string | null = null;
  private familyRevoked = false;
  private inFlightRefresh = 0;
  private validTokens = new Set<string>();
  private expiredTokens = new Set<string>();

  constructor(options: BackendOptions = {}) {
    this.sessionExpiresIn = options.sessionExpiresIn ?? 43200;
    this.latencyMs = options.latencyMs ?? 0;
  }

  install() {
    return vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => this.handle(input, init));
  }

  /** Makes every token issued so far answer 401 TOKEN_EXPIRED. */
  expireAllTokens(): void {
    for (const token of this.validTokens) this.expiredTokens.add(token);
  }

  get lastToken(): string | null {
    return [...this.validTokens].at(-1) ?? null;
  }

  count(path: string): number {
    return this.calls.filter((c) => c.path === path).length;
  }

  private json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  }

  private error(
    status: number,
    code: string,
    details: unknown = null,
    headers: Record<string, string> = {},
  ) {
    return this.json(
      status,
      { code, message: 'server text that must never be shown', details },
      headers,
    );
  }

  private session() {
    const token = `at-${++this.seq}`;
    this.validTokens.add(token);
    return {
      data: {
        accessToken: token,
        tokenType: 'Bearer',
        expiresIn: 28800,
        sessionExpiresIn: this.sessionExpiresIn,
        user: TEST_USER,
      },
    };
  }

  private async wait() {
    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    else await Promise.resolve();
  }

  private async handle(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      'http://localhost',
    );
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    const authorization = headers.get('Authorization');
    this.calls.push({ method, path, authorization });
    const cookieSent = this.cookie;
    await this.wait();

    if (path === '/auth/login') {
      const body = JSON.parse(init?.body as string) as { password: string };
      if (body.password !== 'right-password') return this.error(401, 'INVALID_CREDENTIALS');
      this.familyRevoked = false;
      this.validCookie = this.cookie = `rt-${++this.seq}`;
      return this.json(200, this.session());
    }
    if (path === '/auth/logout') {
      this.familyRevoked = true;
      this.cookie = null;
      return this.json(204, null);
    }
    if (path === '/auth/refresh') {
      this.refreshCount++;
      this.inFlightRefresh++;
      this.maxConcurrentRefresh = Math.max(this.maxConcurrentRefresh, this.inFlightRefresh);
      try {
        if (this.refreshFailure) {
          const { status, code, headers: extra } = this.refreshFailure;
          return this.error(status, code, status === 429 ? { minutes: 15 } : null, extra);
        }
        await this.wait();
        if (cookieSent === null || this.familyRevoked) return this.error(401, 'REFRESH_INVALID');
        if (cookieSent !== this.validCookie) {
          this.familyRevoked = true; // reuse of a rotated cookie revokes the whole family
          return this.error(401, 'REFRESH_INVALID');
        }
        this.validCookie = this.cookie = `rt-${++this.seq}`;
        return this.json(200, this.session());
      } finally {
        this.inFlightRefresh--;
      }
    }

    // Any other path is a protected endpoint.
    const token = authorization?.replace('Bearer ', '') ?? null;
    if (token === null || !this.validTokens.has(token)) return this.error(401, 'UNAUTHENTICATED');
    if (this.expiredTokens.has(token)) return this.error(401, 'TOKEN_EXPIRED');
    return this.json(200, { data: [], page: 1, pageSize: 20, total: 0 });
  }
}

export class FakeLocks implements ExclusiveLock {
  private tails = new Map<string, Promise<unknown>>();
  /** Highest number of tasks holding a lock at once (must stay 1). */
  maxHeld = 0;
  private held = 0;

  run<T>(name: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(name) ?? Promise.resolve();
    const result = previous.then(async () => {
      this.held++;
      this.maxHeld = Math.max(this.maxHeld, this.held);
      try {
        return await task();
      } finally {
        this.held--;
      }
    });
    this.tails.set(
      name,
      result.catch(() => undefined),
    );
    return result;
  }
}

/** Channels created from one bus hear each other (and never themselves), like BroadcastChannel tabs. */
export class FakeChannelBus {
  private readonly channels = new Set<FakeChannel>();
  create = (): SessionChannel => new FakeChannel(this.channels);
}

class FakeChannel implements SessionChannel {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  private readonly all: Set<FakeChannel>;
  constructor(all: Set<FakeChannel>) {
    this.all = all;
    all.add(this);
  }
  postMessage(message: unknown): void {
    const copy = structuredClone(message);
    for (const other of this.all) {
      if (other !== this)
        queueMicrotask(() => other.onmessage?.({ data: copy } as MessageEvent<unknown>));
    }
  }
  close(): void {
    this.all.delete(this);
  }
}
