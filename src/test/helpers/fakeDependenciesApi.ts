// fakeDependenciesApi: in-memory fake of the dependency endpoints behind the API client (no fetch).
// makeDependenciesApi(apps, init) -> { state, client, calls, callsTo, failNext, hold, setGraph, etagOf }
//   GET /dependencies/graph  the graph of an application (404 NOT_FOUND for an unknown applicationId), with the filters
//     `types` and `environment` the way the contract says: `types` keeps those node types, `environment` keeps the
//     variables and collections present in it (state.environments, by node key; a node without an entry is in both) and
//     leaves screens and components alone, and an edge whose end was left out is removed (never a dangling edge).
//   GET /dependencies/{type}/{id}  the neighborhood: the node and what is reachable in at most `depth` steps, in both
//     directions and safe against cycles, with every edge between those nodes; 404 for an unknown element. No filters.
//   Order is the one of the graph the test gives (the real API orders nodes by type and id, and edges by kind).
//   Every answer has an ETag that moves when setGraph changes the data; the calls are recorded.
//   failNext('GET /dependencies/graph', error) makes the next call fail once; hold(predicate) makes the matching calls
//   wait until `release()`. Everything else (screens, applications) goes to the variables fake.
import { vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { ApiClient } from '../../api/client';
import type { GraphData, Environment } from '../../modules/dependency-map/graphTypes';

import { makeVariablesApi, type RecordedApiCall } from './fakeVariablesApi';
import type { makeApplicationsClient } from './renderApp';

export interface DependenciesApiInit {
  /** Graph of each application, by application id. */
  graphs?: Record<number, GraphData>;
  /** Environments of a variable or collection node, by node key (a node without an entry is in DEV and PROD). */
  environments?: Record<string, Environment[]>;
}

const SEGMENT_TYPE: Record<string, string> = {
  screens: 'screen',
  variables: 'variable',
  collections: 'collection',
  components: 'component',
};

function response(body: unknown, etag: string | null = null) {
  return Promise.resolve({ body, status: 200, etag, location: null });
}

function notFound(element: string, id?: unknown): ApiError {
  return new ApiError({ status: 404, code: 'NOT_FOUND', details: { element, id } });
}

/** The nodes reachable from `startKey` in at most `depth` steps, both directions, with the edges between them. */
export function neighborhoodOf(graph: GraphData, startKey: string, depth: number): GraphData {
  const reached = new Set<string>([startKey]);
  let frontier = [startKey];
  for (let step = 0; step < depth; step += 1) {
    const next: string[] = [];
    for (const edge of graph.edges) {
      for (const [from, to] of [
        [edge.source, edge.target],
        [edge.target, edge.source],
      ] as const) {
        if (frontier.includes(from) && !reached.has(to)) {
          reached.add(to);
          next.push(to);
        }
      }
    }
    frontier = next;
  }
  return {
    nodes: graph.nodes.filter((node) => reached.has(node.key)),
    edges: graph.edges.filter((edge) => reached.has(edge.source) && reached.has(edge.target)),
  };
}

export function makeDependenciesApi(
  apps: ReturnType<typeof makeApplicationsClient>,
  init: DependenciesApiInit = {},
) {
  const variablesApi = makeVariablesApi(apps, { screens: [] });
  const state = {
    graphs: { ...(init.graphs ?? {}) } as Record<number, GraphData>,
    environments: init.environments ?? {},
    versions: new Map<string, number>(),
  };
  const calls: RecordedApiCall[] = [];
  const failures = new Map<string, ApiError[]>();
  const holds: Array<{ predicate: (call: RecordedApiCall) => boolean; gate: Promise<void> }> = [];

  const etagOf = (scope: string) => `W/"${scope}-${state.versions.get(scope) ?? 1}"`;
  const versionOf = (applicationId: number) =>
    `${applicationId}-${state.versions.get(`app:${applicationId}`) ?? 1}`;

  function setGraph(applicationId: number, graph: GraphData) {
    state.graphs = { ...state.graphs, [applicationId]: graph };
    const key = `app:${applicationId}`;
    state.versions.set(key, (state.versions.get(key) ?? 1) + 1);
  }

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

  function graphOf(applicationId: unknown): GraphData {
    const graph = typeof applicationId === 'number' ? state.graphs[applicationId] : undefined;
    if (graph === undefined) throw notFound('application', applicationId);
    return graph;
  }

  function filtered(graph: GraphData, query: Record<string, unknown>): GraphData {
    const types = Array.isArray(query.types) ? (query.types as string[]) : null;
    const environment = typeof query.environment === 'string' ? query.environment : null;
    const keep = new Set<string>();
    for (const node of graph.nodes) {
      if (types !== null && !types.includes(node.type)) continue;
      if (environment !== null && (node.type === 'VARIABLE' || node.type === 'COLLECTION')) {
        const present = state.environments[node.key] ?? ['DEV', 'PROD'];
        if (!present.includes(environment as Environment)) continue;
      }
      keep.add(node.key);
    }
    return {
      nodes: graph.nodes.filter((node) => keep.has(node.key)),
      edges: graph.edges.filter((edge) => keep.has(edge.source) && keep.has(edge.target)),
    };
  }

  async function handle(method: string, path: string, options: RecordedApiCall['options'] = {}) {
    if (!path.startsWith('/dependencies')) {
      const fallback = variablesApi.client as unknown as Record<
        string,
        (p: string, o?: unknown) => Promise<unknown>
      >;
      return fallback[method.toLowerCase()]?.(path, options);
    }
    const call: RecordedApiCall = { method, path, options };
    calls.push(call);
    for (const held of holds) if (held.predicate(call)) await held.gate;
    const failure = failures.get(`${method} ${path}`)?.shift();
    if (failure) throw failure;
    const query = options.query ?? {};

    if (method === 'GET' && path === '/dependencies/graph') {
      const applicationId = query.applicationId;
      const graph = graphOf(applicationId);
      return response(
        { data: filtered(graph, query) },
        etagOf(
          `g${versionOf(applicationId as number)}-${JSON.stringify([query.types, query.environment])}`,
        ),
      );
    }
    if (method === 'GET' && path === '/dependencies/{type}/{id}') {
      const type = SEGMENT_TYPE[String(options.path?.type)];
      const key = `${type}:${String(options.path?.id)}`;
      const depth = typeof query.depth === 'number' ? query.depth : 1;
      for (const [applicationId, graph] of Object.entries(state.graphs)) {
        if (graph.nodes.some((node) => node.key === key)) {
          return response(
            { data: neighborhoodOf(graph, key, depth) },
            etagOf(`n${versionOf(Number(applicationId))}-${key}-${depth}`),
          );
        }
      }
      throw notFound(type ?? 'element', options.path?.id);
    }
    throw new Error(`fakeDependenciesApi: unhandled ${method} ${path}`);
  }

  const client = {
    get: vi.fn((path: string, options?: RecordedApiCall['options']) =>
      handle('GET', path, options),
    ),
    post: vi.fn((path: string, options?: RecordedApiCall['options']) =>
      handle('POST', path, options),
    ),
    put: vi.fn((path: string, options?: RecordedApiCall['options']) =>
      handle('PUT', path, options),
    ),
    delete: vi.fn((path: string, options?: RecordedApiCall['options']) =>
      handle('DELETE', path, options),
    ),
  } as unknown as ApiClient;

  const callsTo = (operation: string) =>
    calls.filter((call) => `${call.method} ${call.path}` === operation);

  return { state, client, calls, callsTo, failNext, hold, setGraph, etagOf };
}
