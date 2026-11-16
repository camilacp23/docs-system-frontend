// renderReports: renderApp over the in-memory reports API (fakeReportsApi) in application 1 ("SAR", the one the shell selects),
// at /reports. Options: role (of the signed-in user, default ADMINISTRATOR), path, reports, parameters, applications,
// `prepare` (arms failures or holds on the fake before the first read), settled. Returns what renderApp returns plus `api`.
// Time: a test of the polling calls useFakeReportClock() BEFORE rendering: setTimeout, clearTimeout and Date are fake, and
// the browser's time zone is America/Costa_Rica (the clock does not move by itself), and advance(ms) moves it and lets every answer arrive. The 3 s interval and the 180 s cap
// are then driven without waiting.
import { act } from '@testing-library/react';
import { vi } from 'vitest';

import type { Role } from '../../app/router/routes';
import type { Application } from '../../application/ApplicationContext';

import { COSTA_RICA } from './renderAudit';
import { makeReportsApi, type ReportRow, type ReportsApiInit } from './fakeReportsApi';
import { renderApp } from './renderApp';

export interface RenderReportsOptions extends ReportsApiInit {
  role?: Role;
  path?: string;
  applications?: Application[];
  prepare?: (api: ReturnType<typeof makeReportsApi>) => void;
  settled?: boolean;
  reports?: ReportRow[];
}

export async function renderReports(options: RenderReportsOptions = {}) {
  const role = options.role ?? 'ADMINISTRATOR';
  let api!: ReturnType<typeof makeReportsApi>;
  const view = await renderApp({
    role,
    path: options.path ?? '/reports',
    applications: options.applications,
    settled: options.settled,
    buildClient: (apps) => {
      api = makeReportsApi(apps, {
        role,
        reports: options.reports,
        parameters: options.parameters,
      });
      options.prepare?.(api);
      return api.client;
    },
  });
  return { ...view, api };
}

/** The fake clock of a polling test (see the header). Undo with vi.useRealTimers(). */
export function useFakeReportClock(): { advance: (ms: number) => Promise<void> } {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'Date'],
    now: new Date('2026-10-05T18:00:00.000Z'),
  });
  // eslint-disable-next-line @typescript-eslint/unbound-method -- it is called with the instance below
  const original = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...original.call(this), timeZone: COSTA_RICA };
  });
  return {
    advance: (ms: number) =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      }),
  };
}

/** Tells the page the tab is hidden or visible again (what the browser does when the user changes tab). */
export function setTabVisibility(state: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}
