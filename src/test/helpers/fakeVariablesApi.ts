// fakeVariablesApi: in-memory fake of the variable and screen endpoints behind the API client (no fetch).
// makeVariablesApi(apps, init) -> { state, client, calls, failNext, hold, callsTo }
//   GET /variables (filters q, scope, dataType, environment, originScreenId, untraced, sort, page, pageSize),
//   GET /variables/{id} (with a weak ETag that moves with every write), GET /variables/{id}/dependencies,
//   POST /variables, PUT /variables/{id} (checks If-Match like the server: 412 PRECONDITION_FAILED),
//   DELETE /variables/{id}, GET /screens (paged). Other paths fall back to the applications fake.
//   failNext('PUT /variables/{id}', error) makes the next call to that operation fail once.
//   hold(predicate) makes the matching calls wait until `release()` is called (to test slow answers and races).
import { vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { ApiClient } from '../../api/client';
import type {
  ScreenSummary,
  Variable,
  VariableDependencies,
  VariableSummary,
  VariableWrite,
} from '../../modules/variables/variableTypes';

import type { makeApplicationsClient } from './renderApp';

export interface RecordedApiCall {
  method: string;
  path: string;
  options: {
    path?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: unknown;
    ifMatch?: string;
  };
}

export function makeScreen(
  id: number,
  name: string,
  overrides: Partial<ScreenSummary> = {},
): ScreenSummary {
  return {
    id,
    applicationId: 1,
    name,
    isAppContext: false,
    documentationStatus: 'DRAFT',
    author: { id: 1, name: 'Admin' },
    pendingSubtasks: 0,
    commentCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeVariable(
  id: number,
  name: string,
  overrides: Partial<Variable> = {},
): Variable {
  return {
    id,
    applicationId: 1,
    name,
    dataType: 'TEXT',
    scope: 'GLOBAL',
    originScreen: null,
    fullTraceability: false,
    environments: ['DEV'],
    description: null,
    environmentDetails: [{ environment: 'DEV', notes: null }],
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    ...overrides,
  };
}

export const EMPTY_DEPENDENCIES = (variable: Variable): VariableDependencies => ({
  variable: { id: variable.id, name: variable.name },
  originScreen: variable.originScreen,
  screens: [],
  collections: [],
  components: [],
});

export interface VariablesApiInit {
  variables?: Variable[];
  screens?: ScreenSummary[];
  dependencies?: Record<number, VariableDependencies>;
}

const SORT_KEYS = ['name', 'scope', 'dataType', 'updatedAt'] as const;

function response(body: unknown, etag: string | null = null, status = 200) {
  return Promise.resolve({ body, status, etag, location: null });
}

function summary(variable: Variable): VariableSummary {
  const { description: _description, environmentDetails: _details, ...rest } = variable;
  void _description;
  void _details;
  return rest;
}

export function makeVariablesApi(
  apps: ReturnType<typeof makeApplicationsClient>,
  init: VariablesApiInit = {},
) {
  const state = {
    variables: init.variables ?? [],
    screens: init.screens ?? [],
    dependencies: init.dependencies ?? emptyDependencyMap(),
    versions: new Map<number, number>(),
    nextId: 1000,
  };
  const calls: RecordedApiCall[] = [];
  const failures = new Map<string, ApiError[]>();
  const holds: Array<{ predicate: (call: RecordedApiCall) => boolean; gate: Promise<void> }> = [];

  const etagOf = (id: number) => `W/"${state.versions.get(id) ?? 1}"`;
  const bump = (id: number) => state.versions.set(id, (state.versions.get(id) ?? 1) + 1);

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

  function listVariables(query: Record<string, unknown>) {
    let rows = state.variables.filter((v) => v.applicationId === query.applicationId);
    if (typeof query.q === 'string') {
      const q = query.q.toLowerCase();
      rows = rows.filter((v) => v.name.toLowerCase().includes(q));
    }
    if (query.scope) rows = rows.filter((v) => v.scope === query.scope);
    if (query.dataType) rows = rows.filter((v) => v.dataType === query.dataType);
    if (query.environment) {
      rows = rows.filter((v) => v.environments.includes(query.environment as 'DEV' | 'PROD'));
    }
    if (query.originScreenId)
      rows = rows.filter((v) => v.originScreen?.id === query.originScreenId);
    if (query.untraced === true) rows = rows.filter((v) => v.originScreen === null);
    const sort = typeof query.sort === 'string' ? query.sort : 'name';
    const key = sort.replace(/^-/, '') as (typeof SORT_KEYS)[number];
    if (!SORT_KEYS.includes(key)) {
      throw new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        details: { fields: [{ field: 'sort', rule: 'enum', message: 'x' }] },
      });
    }
    rows = [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
    if (sort.startsWith('-')) rows.reverse();
    const page = (query.page as number | undefined) ?? 1;
    const pageSize = (query.pageSize as number | undefined) ?? 20;
    return {
      data: rows.slice((page - 1) * pageSize, page * pageSize).map(summary),
      page,
      pageSize,
      total: rows.length,
    };
  }

  function find(id: unknown): Variable {
    const found = state.variables.find((v) => v.id === id);
    if (!found)
      throw new ApiError({ status: 404, code: 'NOT_FOUND', details: { element: 'variable' } });
    return found;
  }

  function applyWrite(current: Variable, body: VariableWrite): Variable {
    const originScreen =
      body.originScreenId == null
        ? null
        : (state.screens.find((s) => s.id === body.originScreenId) ?? null);
    return {
      ...current,
      name: body.name,
      dataType: body.dataType,
      scope: body.scope,
      description: body.description ?? null,
      originScreen: originScreen && { id: originScreen.id, name: originScreen.name },
      fullTraceability: originScreen !== null,
      environments: body.environments.map((e) => e.environment),
      environmentDetails: body.environments.map((e) => ({
        environment: e.environment,
        notes: e.notes ?? null,
      })),
      updatedAt: new Date().toISOString(),
    };
  }

  async function handle(method: string, path: string, options: RecordedApiCall['options'] = {}) {
    const call: RecordedApiCall = { method, path, options };
    calls.push(call);
    for (const held of holds) if (held.predicate(call)) await held.gate;
    const queued = failures.get(`${method} ${path}`);
    const failure = queued?.shift();
    if (failure) throw failure;
    const query = options.query ?? {};

    if (method === 'GET' && path === '/variables') return response(listVariables(query));
    if (method === 'GET' && path === '/variables/{id}') {
      const variable = find(options.path?.id);
      return response({ data: variable }, etagOf(variable.id));
    }
    if (method === 'GET' && path === '/variables/{id}/dependencies') {
      const variable = find(options.path?.id);
      return response({ data: state.dependencies[variable.id] ?? EMPTY_DEPENDENCIES(variable) });
    }
    if (method === 'GET' && path === '/screens') {
      const page = (query.page as number | undefined) ?? 1;
      const pageSize = (query.pageSize as number | undefined) ?? 20;
      const rows = state.screens.filter((s) => s.applicationId === query.applicationId);
      return response({
        data: rows.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: rows.length,
      });
    }
    if (method === 'POST' && path === '/variables') {
      const body = options.body as VariableWrite & { applicationId: number };
      const id = state.nextId++;
      const created = applyWrite(
        makeVariable(id, body.name, { applicationId: body.applicationId }),
        body,
      );
      state.variables = [...state.variables, created];
      return response({ data: created }, etagOf(id), 201);
    }
    if (method === 'PUT' && path === '/variables/{id}') {
      const current = find(options.path?.id);
      if (options.ifMatch !== undefined && options.ifMatch !== etagOf(current.id)) {
        throw new ApiError({
          status: 412,
          code: 'PRECONDITION_FAILED',
          details: { element: 'variable', currentETag: etagOf(current.id) },
        });
      }
      const body = options.body as VariableWrite;
      // Like the server (D-71): the scope cannot change while collections assign the variable with the function
      // of the old scope; the error names that function (`Set` or `UpdateContext`).
      if (body.scope !== current.scope) {
        const incompatible = body.scope === 'CONTEXT' ? 'SET' : 'UPDATE_CONTEXT';
        const blocked = state.dependencies[current.id]?.collections.some(
          (assignment) => assignment.assignmentFunction === incompatible,
        );
        if (blocked) {
          throw new ApiError({
            status: 422,
            code: 'SCOPE_CONFLICT',
            details: { function: incompatible === 'SET' ? 'Set' : 'UpdateContext' },
          });
        }
      }
      const updated = applyWrite(current, body);
      state.variables = state.variables.map((v) => (v.id === current.id ? updated : v));
      bump(current.id);
      return response({ data: updated }, etagOf(current.id));
    }
    if (method === 'DELETE' && path === '/variables/{id}') {
      const current = find(options.path?.id);
      state.variables = state.variables.filter((v) => v.id !== current.id);
      return response(null, null, 204);
    }
    // Everything else (applications) goes to the applications fake.
    const fallback = apps.client as unknown as Record<
      string,
      (p: string, o?: unknown) => Promise<unknown>
    >;
    return fallback[method.toLowerCase()]?.(path, options);
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

  return { state, client, calls, callsTo, failNext, hold, etagOf };
}

function emptyDependencyMap(): Record<number, VariableDependencies> {
  return {};
}
