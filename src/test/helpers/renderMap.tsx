// renderMap: renderApp over the in-memory dependency API (fakeDependenciesApi) with the graph of frames S-27 to S-28.
// Options: role, path (default /dependency-map), applications, `graphs` (graph by application id; default: sampleGraph
// for application 1), `environments` (environments by node key) and `prepare` to arm failures or holds before the
// first read. Installs the jsdom stand-ins React Flow needs (reactFlowShims). Returns what renderApp returns plus `api`.
import type { Application } from '../../application/ApplicationContext';
import type { Role } from '../../app/router/routes';
import type { Environment, GraphData } from '../../modules/dependency-map/graphTypes';

import { makeDependenciesApi } from './fakeDependenciesApi';
import { sampleGraph } from './graphFixtures';
import './reactFlowShims';
import { renderApp } from './renderApp';

export interface RenderMapOptions {
  role?: Role;
  path?: string;
  applications?: Application[];
  graphs?: Record<number, GraphData>;
  environments?: Record<string, Environment[]>;
  prepare?: (api: ReturnType<typeof makeDependenciesApi>) => void;
  settled?: boolean;
}

export async function renderMap(options: RenderMapOptions = {}) {
  // The route loads the map lazily. The first import in a cold test worker transforms and evaluates React Flow, which
  // under load takes longer than the 1 s of findBy; loading the module first makes the wait one for the work, not the
  // clock (no timeout is raised). Importing it again later costs nothing: it is cached.
  await import('../../modules/dependency-map/DependencyMapPage');
  let api: ReturnType<typeof makeDependenciesApi> | undefined;
  const view = await renderApp({
    role: options.role ?? 'DEVELOPER',
    path: options.path ?? '/dependency-map',
    applications: options.applications,
    settled: options.settled,
    buildClient: (apps) => {
      api = makeDependenciesApi(apps, {
        graphs: options.graphs ?? { 1: sampleGraph() },
        environments: options.environments,
      });
      options.prepare?.(api);
      return api.client;
    },
  });
  if (api === undefined) throw new Error('buildClient was not called');
  return { ...view, api };
}
