// renderDashboard: renderApp over the in-memory dashboard API (fakeDashboardApi) in application 1 ("SAR", the one the
// shell selects), at /dashboard. The screens the API serves are the sample data of the frames S-31 (Detalle 3 pending,
// App (OnStart) 2, Inicio 1) and the indicators are the figures of S-31.
// Options: role (of the signed-in user, default ADMINISTRATOR), name, path, applications, `indicators` (what each
// application answers, by id), `screens` (full screens, replaces the sample), `prepare` (arms failures or holds on the
// fake before the first read), settled. Returns what renderApp returns plus `api`.
import type { Application } from '../../application/ApplicationContext';
import type { Role } from '../../app/router/routes';
import type { Screen } from '../../modules/screens/screenTypes';

import { makeDashboardApi, makeIndicators, type DashboardApiInit } from './fakeDashboardApi';
import { makeScreenDetail } from './fakeScreensApi';
import { renderApp } from './renderApp';

/** The screens of the frame S-31 with their pending to-dos: Detalle 3, App (OnStart) 2, Inicio 1, and two with none. */
export function sampleDashboardScreens(): Screen[] {
  return [
    makeScreenDetail(10, 'App (OnStart)', {
      isAppContext: true,
      documentationStatus: 'IN_PROGRESS',
      pendingSubtasks: 2,
    }),
    makeScreenDetail(11, 'Inicio', { documentationStatus: 'APPROVED', pendingSubtasks: 1 }),
    makeScreenDetail(12, 'Detalle', { documentationStatus: 'IN_REVIEW', pendingSubtasks: 3 }),
    makeScreenDetail(13, 'Busqueda', { documentationStatus: 'DRAFT', pendingSubtasks: 0 }),
    makeScreenDetail(14, 'Reportes', { documentationStatus: 'UNDOCUMENTED', pendingSubtasks: 0 }),
  ];
}

export interface RenderDashboardOptions {
  role?: Role;
  name?: string;
  path?: string;
  applications?: Application[];
  indicators?: DashboardApiInit['indicators'];
  screens?: Screen[];
  prepare?: (api: ReturnType<typeof makeDashboardApi>) => void;
  settled?: boolean;
}

export async function renderDashboard(options: RenderDashboardOptions = {}) {
  const role = options.role ?? 'ADMINISTRATOR';
  let api!: ReturnType<typeof makeDashboardApi>;
  const view = await renderApp({
    role,
    name: options.name,
    path: options.path ?? '/dashboard',
    applications: options.applications,
    settled: options.settled,
    buildClient: (apps) => {
      api = makeDashboardApi(apps, {
        role,
        screenDetails: options.screens ?? sampleDashboardScreens(),
        indicators: options.indicators ?? {
          1: makeIndicators({ recentActivity: [] }),
        },
      });
      options.prepare?.(api);
      return api.client;
    },
  });
  return { ...view, api };
}
