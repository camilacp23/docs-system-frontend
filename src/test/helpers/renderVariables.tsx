// renderVariables: renderApp over the in-memory variables API (fakeVariablesApi) with the sample data of the
// frames S-10 / S-11: three screens (App (OnStart), Inicio, Detalle) and the variables gUsuario, gFiltroActivo,
// gRegistroSel (untraced), locMostrarDetalle and locOrden. Options: role, path, applications, plus `variables`,
// `screens` and `dependencies` to replace the sample data, `prepare` to arm failures before the first read. Returns what renderApp returns plus `api`.
import type { Application } from '../../application/ApplicationContext';
import type { Role } from '../../app/router/routes';
import type {
  ScreenSummary,
  Variable,
  VariableDependencies,
} from '../../modules/variables/variableTypes';

import { makeScreen, makeVariable, makeVariablesApi } from './fakeVariablesApi';
import { renderApp } from './renderApp';

export const APP_SCREEN = makeScreen(10, 'App (OnStart)', { isAppContext: true });
export const SCREEN_INICIO = makeScreen(11, 'Inicio');
export const SCREEN_DETALLE = makeScreen(12, 'Detalle');

export function sampleVariables(): Variable[] {
  const origin = (screen: ScreenSummary) => ({
    originScreen: { id: screen.id, name: screen.name },
    fullTraceability: true,
  });
  return [
    makeVariable(1, 'gUsuario', {
      dataType: 'RECORD',
      ...origin(APP_SCREEN),
      environments: ['DEV', 'PROD'],
      description: 'Signed-in user record, loaded at start.',
      environmentDetails: [
        { environment: 'DEV', notes: null },
        { environment: 'PROD', notes: 'Loaded from the production user list.' },
      ],
      updatedAt: '2026-10-03T09:14:00',
    }),
    makeVariable(2, 'gFiltroActivo', {
      dataType: 'BOOLEAN',
      ...origin(SCREEN_INICIO),
      updatedAt: '2026-10-02T16:40:00',
    }),
    makeVariable(3, 'gRegistroSel', {
      dataType: 'RECORD',
      environments: ['DEV', 'PROD'],
      environmentDetails: [
        { environment: 'DEV', notes: null },
        { environment: 'PROD', notes: null },
      ],
      updatedAt: '2026-09-30T11:02:00',
    }),
    makeVariable(4, 'locMostrarDetalle', {
      dataType: 'BOOLEAN',
      scope: 'CONTEXT',
      ...origin(SCREEN_DETALLE),
      updatedAt: '2026-09-29T15:22:00',
    }),
    makeVariable(5, 'locOrden', {
      dataType: 'NUMBER',
      scope: 'CONTEXT',
      ...origin(SCREEN_INICIO),
      updatedAt: '2026-09-29T15:20:00',
    }),
  ];
}

export interface RenderVariablesOptions {
  role?: Role;
  path?: string;
  applications?: Application[];
  variables?: Variable[];
  screens?: ScreenSummary[];
  dependencies?: Record<number, VariableDependencies>;
  /** Runs on the fake API before the first render, to arm failures or holds for the first reads. */
  prepare?: (api: ReturnType<typeof makeVariablesApi>) => void;
}

export async function renderVariables(options: RenderVariablesOptions = {}) {
  let api: ReturnType<typeof makeVariablesApi> | undefined;
  const view = await renderApp({
    role: options.role ?? 'DEVELOPER',
    path: options.path ?? '/variables',
    applications: options.applications,
    buildClient: (apps) => {
      api = makeVariablesApi(apps, {
        variables: options.variables ?? sampleVariables(),
        screens: options.screens ?? [APP_SCREEN, SCREEN_INICIO, SCREEN_DETALLE],
        dependencies: options.dependencies,
      });
      options.prepare?.(api);
      return api.client;
    },
  });
  if (api === undefined) throw new Error('buildClient was not called');
  return { ...view, api };
}
