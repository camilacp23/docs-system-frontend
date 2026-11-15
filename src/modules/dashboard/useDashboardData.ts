// useDashboardData: the two reads of the dashboard (FR-19), each with its own state so one can fail while the other is
// still on screen: the indicators (GET /dashboard/indicators) and the screens with the most pending to-dos
// (GET /screens?sort=-pendingSubtasks, D-54; the top five with pending to-dos).
// useDashboardData(applicationId) -> { indicators, top, reload }
//   indicators / top   { status, data, error, reload }. `data` is null while it belongs to another application (the list
//                      keeps the last answer while a new key loads; here an answer of another application never shows).
//   reload()           reads both again (the Refresh button); a read in flight is dropped by its own key.
// Both reads revalidate with the ETag through the shared client (cache: 'no-cache', D-72); the dashboard of an archived
// application is read like any other. The indicators carry the time of the read for "Updated 10:24".
import { useCallback } from 'react';

import type { ApiError } from '../../api/ApiError';
import { useApi } from '../../api/useApi';
import { useApiResource, type ApiResource } from '../../api/useApiResource';

import type { Indicators, TopScreen } from './dashboardModel';

/** How many screens the "Pending to-dos by screen" card lists (S-31 draws the top ones). */
export const TOP_SCREENS = 5;
/**
 * The page asked for. The API lists App (OnStart) first whatever the order (contract, `GET /screens`), so a page of
 * TOP_SCREENS would hold App plus only the top four of the others and drop the fifth when App has fewer pending to-dos
 * than that one. One more row always leaves the five most pending in the page.
 */
export const TOP_PAGE_SIZE = TOP_SCREENS + 1;

export interface IndicatorsRead {
  applicationId: number;
  indicators: Indicators;
  /** ISO instant of the answer. */
  readAt: string;
}

export interface TopRead {
  applicationId: number;
  screens: TopScreen[];
}

export interface DashboardSource<T> {
  status: 'loading' | 'ready' | 'error';
  data: T | null;
  error: ApiError | null;
  reload: () => void;
}

export function useDashboardData(applicationId: number | null) {
  const client = useApi();
  const enabled = applicationId !== null;
  const id = applicationId ?? 0;

  const indicators = useApiResource<IndicatorsRead>(
    `dashboard-indicators:${id}`,
    async (signal) => {
      const { body, etag } = await client.get('/dashboard/indicators', {
        query: { applicationId: id },
        signal,
      });
      return {
        body: { applicationId: id, indicators: body.data, readAt: new Date().toISOString() },
        etag,
      };
    },
    enabled,
  );

  const top = useApiResource<TopRead>(
    `dashboard-top:${id}`,
    async (signal) => {
      const { body, etag } = await client.get('/screens', {
        query: { applicationId: id, sort: '-pendingSubtasks', page: 1, pageSize: TOP_PAGE_SIZE },
        signal,
      });
      // App (OnStart) comes first from the API; the most pending go first here (a stable sort keeps the API order of ties).
      const screens = body.data
        .filter((screen) => screen.pendingSubtasks > 0)
        .map((screen) => ({ id: screen.id, name: screen.name, pending: screen.pendingSubtasks }))
        .sort((a, b) => b.pending - a.pending)
        .slice(0, TOP_SCREENS);
      return { body: { applicationId: id, screens }, etag };
    },
    enabled,
  );

  const reloadIndicators = indicators.reload;
  const reloadTop = top.reload;
  const reload = useCallback(() => {
    reloadIndicators();
    reloadTop();
  }, [reloadIndicators, reloadTop]);

  const source = <T extends { applicationId: number }>(
    resource: ApiResource<T>,
  ): DashboardSource<T> => ({
    status: resource.status,
    data: resource.data !== null && resource.data.applicationId === id ? resource.data : null,
    error: resource.error,
    reload: resource.reload,
  });

  return {
    indicators: source(indicators),
    top: source(top),
    reload,
  };
}
