// browserApis: the two browser coordination primitives behind a small interface, so tests can replace them.
// - ExclusiveLock: Web Locks (navigator.locks) so that only one refresh is in flight in the whole browser (R-4).
//   Chrome and Edge (NFR-18) support it. Without it there is no cross-tab serialization: the SessionManager still
//   keeps a single in-flight refresh INSIDE each tab, but two tabs may refresh at the same time and the backend
//   would then revoke the session family (D-38). That limitation is accepted (no localStorage lease, by decision).
// - SessionChannel: BroadcastChannel (same-origin, in memory) to share the new session and the logout.

export interface ExclusiveLock {
  /** Runs `task` while holding the named lock; waiters run one at a time. */
  run<T>(name: string, task: () => Promise<T>): Promise<T>;
}

export interface SessionChannel {
  postMessage(message: unknown): void;
  /** Called with every message posted by OTHER contexts. */
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  close(): void;
}

export const REFRESH_LOCK_NAME = 'docs-session-refresh';
export const SESSION_CHANNEL_NAME = 'docs-session';

export function getBrowserLock(): ExclusiveLock | null {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) return null;
  return {
    run: <T>(name: string, task: () => Promise<T>) => locks.request(name, task) as Promise<T>,
  };
}

export function createBrowserChannel(): SessionChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  return new BroadcastChannel(SESSION_CHANNEL_NAME);
}
