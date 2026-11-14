// renderAudit: renderApp over the in-memory audit API (fakeAuditApi) with the users of the user fake, in application
// 1 ("SAR", the one the shell selects). Options: role (of the signed-in user, default ADMINISTRATOR), path (default
// /audit), entries, users, applications, `prepare` (arms failures on the fake before the first read). Returns what
// renderApp returns plus `api`.
// Time and zone: tests that depend on them call fixClock(): the system time is 2026-10-05 12:00 in Costa Rica
// (18:00Z) and the browser's time zone is America/Costa_Rica (UTC-6, no daylight time), so "today" is Oct 5 and
// "Last 7 days" is Sep 29 to Oct 5 whatever the machine says. Only Date is faked (timers keep running).
import { vi } from 'vitest';

import type { Role } from '../../app/router/routes';
import type { Application } from '../../application/ApplicationContext';

import { makeAuditApi, type AuditApiInit } from './fakeAuditApi';
import { SELF_ID } from './fakeUsersApi';
import { renderApp } from './renderApp';
import { sampleUsers } from './renderUsers';

export const COSTA_RICA = 'America/Costa_Rica';
export const NOW = '2026-10-05T18:00:00.000Z';

/**
 * The system time and the browser's time zone, fixed (see the header). `searchPause: true` also fakes setTimeout /
 * clearTimeout (the clock follows the real one) so endSearchPause() can end the pause of a search box at once.
 * Undo with vi.useRealTimers + vi.restoreAllMocks.
 */
export function fixClock(options: { searchPause?: boolean } = {}): void {
  vi.useFakeTimers({
    toFake: options.searchPause ? ['Date', 'setTimeout', 'clearTimeout'] : ['Date'],
    shouldAdvanceTime: options.searchPause === true,
    now: new Date(NOW),
  });
  // eslint-disable-next-line @typescript-eslint/unbound-method -- it is called with the instance below
  const original = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...original.call(this), timeZone: COSTA_RICA };
  });
}

export interface RenderAuditOptions extends Pick<AuditApiInit, 'entries'> {
  role?: Role;
  path?: string;
  applications?: Application[];
  users?: AuditApiInit['users'];
  prepare?: (api: ReturnType<typeof makeAuditApi>) => void;
}

export async function renderAudit(options: RenderAuditOptions = {}) {
  let api: ReturnType<typeof makeAuditApi> | undefined;
  const role = options.role ?? 'ADMINISTRATOR';
  const view = await renderApp({
    role,
    path: options.path ?? '/audit',
    applications: options.applications,
    buildClient: (apps) => {
      api = makeAuditApi(apps, {
        entries: options.entries ?? [],
        role,
        selfId: SELF_ID,
        users: options.users ?? sampleUsers(),
      });
      options.prepare?.(api);
      return api.client;
    },
  });
  if (api === undefined) throw new Error('buildClient was not called');
  return { ...view, api };
}
