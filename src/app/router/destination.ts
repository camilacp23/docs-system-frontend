// destination: the page the user wanted before being sent to /login. It travels in the router `state`
// (memory only, never storage) as `{ from: '/path?query#hash' }`.
// readDestination(state) returns it only if it is an internal path other than /login; otherwise null.
import type { Location } from 'react-router';

import { LOGIN_PATH } from './routes';

export interface LoginRouteState {
  from?: string;
}

export function destinationOf(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function readDestination(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null;
  const from = (state as LoginRouteState).from;
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return null;
  const pathname = from.split(/[?#]/)[0];
  return pathname === LOGIN_PATH ? null : from;
}
