// fakeDashboardApi: in-memory fake of GET /dashboard/indicators (and the screens read of the dashboard) behind the API
// client (no fetch).
// makeDashboardApi(apps, init) -> { state, client, calls, callsTo, failNext, hold, screens }
//   init: role (of the signed-in user: the Reader gets NO `recentActivity` key, D-34), indicators (what each application
//   answers, by id; default: application 1 with the figures of the frame S-31), screenDetails (the screens GET /screens
//   serves, see makeScreensApi), jira.
//   It answers like the server (SDD 7.2.6, D-106): 404 NOT_FOUND for an application that does not exist, a weak ETag, the
//   10 most recent records for an Administrator and a Developer. `state.indicators` can be changed by a test between two
//   reads. `/screens` goes to the screens fake, so `sort=-pendingSubtasks` (App (OnStart) first, whatever the order)
//   behaves like the API.
//   failNext('GET /dashboard/indicators' | 'GET /screens', error) makes the next read fail once (for 'GET /screens', the
//   next read of the dashboard, the one with `sort`, not the count of the sidebar); hold(predicate) keeps
//   the matching read of the indicators waiting until release() is called (holdScreens does the same for /screens).
import { vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';

import { makeScreensApi, type ScreensApiInit } from './fakeScreensApi';
import type { RecordedApiCall } from './fakeVariablesApi';
import type { makeApplicationsClient } from './renderApp';

type Indicators = components['schemas']['IndicatorsEnvelope']['data'];
type Activity = components['schemas']['ActivitySummary'];
type Role = components['schemas']['UserRole'];
type ByStatus = Indicators['documentation']['byStatus'];

export interface IndicatorsInit {
  byStatus?: Partial<ByStatus>;
  /** Replaces the value calculated from `byStatus` (the API rounds half up to one decimal). */
  approvedPercent?: number;
  variables?: Indicators['variables'];
  collections?: Indicators['collections'];
  jira?: Partial<Indicators['jira']>;
  recentActivity?: Activity[];
}

/** The API's rounding in whole numbers (D-106): tenths of a percent, half up. */
function approvedPercentOf(approved: number, total: number): number {
  return total === 0 ? 0 : Math.floor((2 * approved * 1000 + total) / (2 * total)) / 10;
}

/** The answer of the API for an application: the figures of the frame S-31 unless said otherwise. */
export function makeIndicators(init: IndicatorsInit = {}): Indicators {
  const byStatus: ByStatus = {
    UNDOCUMENTED: 2,
    DRAFT: 3,
    IN_PROGRESS: 6,
    IN_REVIEW: 3,
    APPROVED: 10,
    ...init.byStatus,
  };
  const totalScreens = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
  return {
    documentation: {
      totalScreens,
      byStatus,
      approvedPercent: init.approvedPercent ?? approvedPercentOf(byStatus.APPROVED, totalScreens),
    },
    variables: init.variables ?? { total: 134, untraced: 9 },
    collections: init.collections ?? { total: 4, undocumented: 1 },
    jira: {
      pendingSubtasks: 6,
      jiraAvailable: true,
      lastSyncedAt: '2026-10-05T14:40:00.000Z',
      ...init.jira,
    },
    ...(init.recentActivity !== undefined && { recentActivity: init.recentActivity }),
  };
}

/** One record of the recent activity as the API sends it (an update of a screen by Ana Mora unless said otherwise). */
export function makeActivity(id: number, overrides: Partial<Activity> = {}): Activity {
  return {
    actor: { id: 7, name: 'Ana Mora' },
    action: 'UPDATE',
    eventName: null,
    entityType: 'screen',
    entityId: String(id),
    entityLabel: `Screen${id}`,
    createdAt: '2026-10-05T16:21:00.000Z',
    ...overrides,
  };
}

export interface DashboardApiInit extends ScreensApiInit {
  role?: Role;
  /** What each application answers, by id. Application 1 has the figures of S-31 when it is not given. */
  indicators?: Record<number, Indicators>;
}

function notFound(id: unknown): ApiError {
  return new ApiError({ status: 404, code: 'NOT_FOUND', details: { element: 'application', id } });
}

export function makeDashboardApi(
  apps: ReturnType<typeof makeApplicationsClient>,
  init: DashboardApiInit = {},
) {
  const screens = makeScreensApi(apps, init);
  const role = init.role ?? 'ADMINISTRATOR';
  const state = {
    indicators: init.indicators ?? { 1: makeIndicators({ recentActivity: [] }) },
  };
  const calls: RecordedApiCall[] = [];
  const failures = new Map<string, ApiError[]>();
  const holds: Array<{ predicate: (call: RecordedApiCall) => boolean; gate: Promise<void> }> = [];

  function failNext(operation: string, error: ApiError) {
    failures.set(operation, [...(failures.get(operation) ?? []), error]);
  }

  function hold(predicate: (call: RecordedApiCall) => boolean) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    holds.push({ predicate, gate });
    return { release };
  }

  async function getIndicators(options: RecordedApiCall['options']) {
    const call: RecordedApiCall = { method: 'GET', path: '/dashboard/indicators', options };
    calls.push(call);
    for (const held of holds) if (held.predicate(call)) await held.gate;
    const failure = failures.get('GET /dashboard/indicators')?.shift();
    if (failure) throw failure;
    const applicationId = options.query?.applicationId;
    const known = apps.state.applications.some((a) => a.id === applicationId);
    const found = typeof applicationId === 'number' ? state.indicators[applicationId] : undefined;
    if (!known || found === undefined) throw notFound(applicationId);
    // The Reader gets the overview: the key is absent, never null (D-34).
    const { recentActivity, ...overview } = found;
    const data: Indicators =
      role === 'READER'
        ? overview
        : { ...overview, recentActivity: (recentActivity ?? []).slice(0, 10) };
    return {
      body: { data },
      status: 200,
      etag: `W/"${String(applicationId)}-${JSON.stringify(data).length}"`,
      location: null,
    };
  }

  const get = vi.fn((path: string, options: RecordedApiCall['options'] = {}) => {
    if (path === '/dashboard/indicators') return getIndicators(options);
    // The dashboard's own read of the screens is the one ordered by `sort`; the count of the sidebar (pageSize 1) is
    // another read of the same operation and is left alone by failNext.
    if (path === '/screens' && options.query?.sort !== undefined) {
      const failure = failures.get('GET /screens')?.shift();
      if (failure) return Promise.reject(failure);
    }
    return (screens.client.get as (p: string, o?: unknown) => Promise<unknown>)(path, options);
  });
  const client = { ...screens.client, get } as unknown as ApiClient;

  const callsTo = (operation: string) =>
    operation === 'GET /dashboard/indicators' ? calls : screens.callsTo(operation);

  return { state, client, calls, callsTo, failNext, hold, holdScreens: screens.hold, screens };
}
