// SessionManager: the session state machine, independent of React (SessionProvider wraps it).
// - The access token lives only in this object's memory (never localStorage / sessionStorage / cookies).
// - bootstrap: on start() it tries POST /auth/refresh to recover the session after a page load.
// - login(email, password) / logout() / refreshAfterUnauthorized(failedToken) (used by the API client on a 401).
// - R-4: at most one refresh in flight per tab (shared promise) and per browser (Web Locks, see browserApis.ts).
//   A refresh queued behind another tab's is skipped if that tab shared a newer session meanwhile.
//   BroadcastChannel shares the new session, the logout and a revocation between tabs.
// - End of session = now + sessionExpiresIn when the response arrives. phase: 'active' -> 'endingSoon' (10 min
//   before) -> 'expired' (the end was reached or the refresh cookie was revoked).
// Snapshot: { status, phase, user, role, endsAt, endReason, lastUser, bootstrapError }.
//   status: initializing | authenticated | anonymous | unavailable (the first refresh failed for a reason other
//   than "no session": network, 5xx, 429). After an end (expired / revoked / logout) status is anonymous;
//   endReason says why and lastUser keeps who it was for the "sign in again" modal (not after logout).
import { ApiError, isApiError } from '../api/ApiError';
import type { SessionPort } from '../api/client';
import { rawRequest } from '../api/http';
import type { components } from '../api/schema';

import {
  REFRESH_LOCK_NAME,
  createBrowserChannel,
  getBrowserLock,
  type ExclusiveLock,
  type SessionChannel,
} from './browserApis';

type User = components['schemas']['User'];
type SessionData = components['schemas']['SessionResponse']['data'];

export type SessionStatus = 'initializing' | 'authenticated' | 'anonymous' | 'unavailable';
export type SessionPhase = 'active' | 'endingSoon' | 'expired';
export type EndReason = 'logout' | 'expired' | 'revoked';

export interface SessionSnapshot {
  status: SessionStatus;
  phase: SessionPhase | null;
  user: User | null;
  role: User['role'] | null;
  /** Epoch ms of the absolute end of the session. */
  endsAt: number | null;
  endReason: EndReason | null;
  lastUser: User | null;
  bootstrapError: ApiError | null;
}

export interface SessionManagerDeps {
  lock?: ExclusiveLock | null;
  createChannel?: () => SessionChannel | null;
  now?: () => number;
}

/** The warning of the session ending is shown this long before the end (S-43a). */
export const ENDING_SOON_MS = 10 * 60 * 1000;
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

type SharedSession = { accessToken: string; user: User; endsAt: number };
type ChannelMessage =
  | ({ type: 'session' } & SharedSession)
  | ({ type: 'hello-reply' } & SharedSession)
  | { type: 'hello' }
  | { type: 'logout' }
  | { type: 'ended' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseMessage(data: unknown): ChannelMessage | null {
  if (!isRecord(data) || typeof data.type !== 'string') return null;
  switch (data.type) {
    case 'hello':
    case 'logout':
    case 'ended':
      return { type: data.type };
    case 'session':
    case 'hello-reply':
      if (
        typeof data.accessToken === 'string' &&
        isRecord(data.user) &&
        typeof data.endsAt === 'number'
      ) {
        return {
          type: data.type,
          accessToken: data.accessToken,
          user: data.user as User,
          endsAt: data.endsAt,
        };
      }
      return null;
    default:
      return null;
  }
}

export class SessionManager implements SessionPort {
  private readonly lock: ExclusiveLock | null;
  private readonly createChannel: () => SessionChannel | null;
  private readonly now: () => number;

  private token: string | null = null;
  private user: User | null = null;
  private lastUser: User | null = null;
  private endsAt: number | null = null;
  private status: SessionStatus = 'initializing';
  private phase: SessionPhase | null = null;
  private endReason: EndReason | null = null;
  private bootstrapError: ApiError | null = null;

  /** Bumped on every adopted session: a queued refresh is skipped if it changed while waiting. */
  private version = 0;
  /** Bumped on logout / end: a refresh that answers after it is discarded. */
  private generation = 0;
  private refreshInFlight: Promise<string> | null = null;
  private bootstrapInFlight: Promise<void> | null = null;

  private channel: SessionChannel | null = null;
  private started = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private snapshot: SessionSnapshot;

  constructor(deps: SessionManagerDeps = {}) {
    this.lock = deps.lock !== undefined ? deps.lock : getBrowserLock();
    this.createChannel = deps.createChannel ?? createBrowserChannel;
    this.now = deps.now ?? (() => Date.now());
    this.snapshot = this.buildSnapshot();
  }

  // --- external store (useSyncExternalStore) ------------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): SessionSnapshot => this.snapshot;

  private buildSnapshot(): SessionSnapshot {
    return {
      status: this.status,
      phase: this.phase,
      user: this.user,
      role: this.user?.role ?? null,
      endsAt: this.endsAt,
      endReason: this.endReason,
      lastUser: this.lastUser,
      bootstrapError: this.bootstrapError,
    };
  }

  private emit(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of [...this.listeners]) listener();
  }

  // --- lifecycle -----------------------------------------------------------------------------------------

  start(): void {
    if (this.started) return;
    this.started = true;
    this.channel = this.createChannel();
    if (this.channel) {
      this.channel.onmessage = (event) => {
        this.onChannelMessage(event.data);
      };
      this.channel.postMessage({ type: 'hello' } satisfies ChannelMessage);
    }
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    if (this.status === 'initializing') void this.bootstrap();
    else this.schedule();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.clearTimer();
    if (this.channel) {
      this.channel.onmessage = null;
      this.channel.close();
      this.channel = null;
    }
  }

  private onVisibilityChange = (): void => {
    if (!document.hidden) this.tick();
  };

  /** Recover the session after a page load. Never rejects: the outcome is in the snapshot. */
  bootstrap(): Promise<void> {
    this.bootstrapInFlight ??= this.runBootstrap().finally(() => {
      this.bootstrapInFlight = null;
    });
    return this.bootstrapInFlight;
  }

  private async runBootstrap(): Promise<void> {
    try {
      await this.refreshShared();
    } catch (error) {
      if (this.status === 'authenticated') return; // another tab shared a session meanwhile
      if (isApiError(error) && error.code === 'REFRESH_INVALID') {
        this.status = 'anonymous';
        this.bootstrapError = null;
      } else {
        this.status = 'unavailable';
        this.bootstrapError = isApiError(error)
          ? error
          : new ApiError({ status: 0, code: 'NETWORK_ERROR' });
      }
      this.emit();
    }
  }

  /** Try again after status 'unavailable'. */
  retryBootstrap(): Promise<void> {
    this.status = 'initializing';
    this.bootstrapError = null;
    this.emit();
    return this.bootstrap();
  }

  // --- credentials -----------------------------------------------------------------------------------------

  getAccessToken(): string | null {
    return this.status === 'authenticated' ? this.token : null;
  }

  /** Rejects with the ApiError of the login (INVALID_CREDENTIALS, RATE_LIMITED, ...). Never triggers a refresh. */
  async login(email: string, password: string): Promise<User> {
    const result = await this.exclusive(() =>
      rawRequest<{ data: SessionData }>({
        method: 'POST',
        path: '/auth/login',
        body: { email, password },
      }),
    );
    this.adopt(result.body.data, true);
    return result.body.data.user;
  }

  /**
   * POST /auth/logout, then clears the local session whatever the outcome (the call is idempotent). If the call
   * failed (network, 429) the error is rethrown AFTER clearing, so the UI can tell the cookie may still be valid.
   */
  async logout(): Promise<void> {
    this.generation++;
    let failure: unknown = null;
    try {
      await this.exclusive(() => rawRequest({ method: 'POST', path: '/auth/logout' }));
    } catch (error) {
      failure = error;
    }
    this.clearSession('logout');
    this.post({ type: 'logout' });
    if (failure !== null) throw failure instanceof Error ? failure : new Error('Logout failed');
  }

  // --- refresh (R-4) ----------------------------------------------------------------------------------------

  refreshAfterUnauthorized(failedToken: string | null): Promise<string> {
    if (this.token !== null && this.status === 'authenticated' && this.token !== failedToken) {
      return Promise.resolve(this.token); // someone already renewed it
    }
    return this.refreshShared();
  }

  endSessionUnauthorized(): void {
    if (this.status !== 'authenticated') return;
    this.clearSession('revoked');
    this.post({ type: 'ended' });
  }

  private refreshShared(): Promise<string> {
    if (this.refreshInFlight) return this.refreshInFlight;
    const versionWhenQueued = this.version;
    const promise = this.exclusive(async () => {
      // Another tab may have refreshed while this one waited for the lock: use its result.
      if (this.version > versionWhenQueued && this.token !== null) return this.token;
      return this.callRefresh();
    }).finally(() => {
      if (this.refreshInFlight === promise) this.refreshInFlight = null;
    });
    this.refreshInFlight = promise;
    return promise;
  }

  private async callRefresh(): Promise<string> {
    const generation = this.generation;
    try {
      const result = await rawRequest<{ data: SessionData }>({
        method: 'POST',
        path: '/auth/refresh',
      });
      if (generation !== this.generation)
        throw new ApiError({ status: 401, code: 'REFRESH_INVALID' });
      this.adopt(result.body.data, true);
      return result.body.data.accessToken;
    } catch (error) {
      if (isApiError(error) && error.code === 'REFRESH_INVALID' && generation === this.generation) {
        if (this.status === 'authenticated') {
          this.clearSession('revoked');
          this.post({ type: 'ended' });
        }
      }
      throw error;
    }
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    return this.lock ? this.lock.run(REFRESH_LOCK_NAME, task) : task();
  }

  // --- state transitions --------------------------------------------------------------------------------------

  private adopt(data: SessionData, broadcast: boolean): void {
    this.applySession(data.accessToken, data.user, this.now() + data.sessionExpiresIn * 1000);
    if (broadcast) this.post({ type: 'session', ...this.sharedSession() });
  }

  private applySession(accessToken: string, user: User, endsAt: number): void {
    this.token = accessToken;
    this.user = user;
    this.lastUser = null;
    this.endsAt = endsAt;
    this.status = 'authenticated';
    this.endReason = null;
    this.bootstrapError = null;
    this.version++;
    this.generation++;
    this.phase = this.computePhase();
    this.schedule();
    this.emit();
    if (this.phase === 'expired') this.tick();
  }

  private sharedSession(): SharedSession {
    return { accessToken: this.token ?? '', user: this.user as User, endsAt: this.endsAt ?? 0 };
  }

  private clearSession(reason: EndReason): void {
    this.lastUser = reason === 'logout' ? null : this.user;
    this.token = null;
    this.user = null;
    this.status = 'anonymous';
    this.phase = reason === 'logout' ? null : 'expired';
    this.endReason = reason;
    this.generation++;
    this.clearTimer();
    this.emit();
  }

  private computePhase(): SessionPhase | null {
    if (this.endsAt === null) return null;
    const remaining = this.endsAt - this.now();
    if (remaining <= 0) return 'expired';
    return remaining <= ENDING_SOON_MS ? 'endingSoon' : 'active';
  }

  private tick = (): void => {
    if (this.status !== 'authenticated') return;
    const phase = this.computePhase();
    if (phase === 'expired') {
      this.clearSession('expired');
      return;
    }
    if (phase !== this.phase) {
      this.phase = phase;
      this.emit();
    }
    this.schedule();
  };

  private schedule(): void {
    this.clearTimer();
    if (!this.started || this.status !== 'authenticated' || this.endsAt === null) return;
    const remaining = this.endsAt - this.now();
    const delay = this.phase === 'endingSoon' ? remaining : remaining - ENDING_SOON_MS;
    this.timer = setTimeout(this.tick, Math.min(Math.max(delay, 0), MAX_TIMEOUT_MS));
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  // --- BroadcastChannel -----------------------------------------------------------------------------------------

  private post(message: ChannelMessage): void {
    this.channel?.postMessage(message);
  }

  private onChannelMessage(data: unknown): void {
    const message = parseMessage(data);
    if (message === null) return;
    switch (message.type) {
      case 'hello':
        if (this.status === 'authenticated' && this.token !== null) {
          this.post({ type: 'hello-reply', ...this.sharedSession() });
        }
        break;
      case 'hello-reply':
        if (this.status !== 'authenticated')
          this.applySession(message.accessToken, message.user, message.endsAt);
        break;
      case 'session':
        this.applySession(message.accessToken, message.user, message.endsAt);
        break;
      case 'logout':
        if (this.status === 'authenticated') this.clearSession('logout');
        break;
      case 'ended':
        if (this.status === 'authenticated') this.clearSession('revoked');
        break;
    }
  }
}
