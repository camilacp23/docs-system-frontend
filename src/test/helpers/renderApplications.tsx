// renderApplications: renderApp over the in-memory applications API (fakeApplicationsApi), shared by the shell and the
// pages, with the sample data of frame S-07: SAR (department Jira project), Application B (key APPB) and Application C
// (archived). Options: role (of the signed-in user), path, `applications` to replace the sample data, `prepare` to arm
// failures or holds before the first read. The shell picks the first ACTIVE application by name (Application B);
// tests that need another one choose it from the selector of the sidebar. Returns what renderApp returns plus `api`.
import type { Application } from '../../application/ApplicationContext';
import type { Role } from '../../app/router/routes';

import { makeApplicationsApi } from './fakeApplicationsApi';
import { makeApplication, renderApp, type makeApplicationsClient } from './renderApp';

export function sampleApplications(): Application[] {
  return [
    makeApplication(1, {
      name: 'SAR',
      description: 'Sistema de Administración de Requerimientos',
      jiraProjectKey: null,
      createdBy: { id: 7, name: 'Ana Mora' },
      updatedAt: '2026-09-28T10:12:00',
      appContextScreen: { id: 10, name: 'App (OnStart)' },
    }),
    makeApplication(2, {
      name: 'Application B',
      jiraProjectKey: 'APPB',
      createdBy: { id: 7, name: 'Ana Mora' },
      updatedAt: '2026-10-02T09:40:00',
      appContextScreen: { id: 20, name: 'App (OnStart)' },
    }),
    makeApplication(3, {
      name: 'Application C',
      status: 'ARCHIVED',
      jiraProjectKey: null,
      createdBy: { id: 2, name: 'Sample Admin' },
      updatedAt: '2026-10-04T15:05:00',
      appContextScreen: { id: 30, name: 'App (OnStart)' },
    }),
  ];
}

export interface RenderApplicationsOptions {
  role?: Role;
  path?: string;
  applications?: Application[];
  /** Runs on the fake API before the first render, to arm failures or holds for the first reads. */
  prepare?: (api: ReturnType<typeof makeApplicationsApi>) => void;
}

export async function renderApplications(options: RenderApplicationsOptions = {}) {
  const api = makeApplicationsApi(options.applications ?? sampleApplications());
  options.prepare?.(api);
  const view = await renderApp({
    role: options.role ?? 'ADMINISTRATOR',
    path: options.path ?? '/admin/applications',
    applicationsApi: api as unknown as ReturnType<typeof makeApplicationsClient>,
  });
  return { ...view, api };
}
