// fakeApplicationsApi: in-memory fake of the application endpoints behind the API client (no fetch). It stands in for
// the minimal applications fake of renderApp when a test is about the applications themselves: the shell (the
// ApplicationProvider) and the pages read the SAME state, so a write is seen by both, as with the real API.
// makeApplicationsApi(initial) -> { state, get, post, put, client, calls, callsTo, failNext, hold, etagOf }
//   GET /applications (q on the name, status, page, pageSize <= 100; ordered by name, then id, no `sort`),
//   POST /applications, GET /applications/{id} (weak ETag that moves with every write), PUT /applications/{id}
//   (If-Match like the server: 412 PRECONDITION_FAILED). Bodies are checked like the validator of the API, which
//   rejects any property the contract does not declare (`unevaluatedProperties: false`); the checks come before 404
//   and 412 (400 -> 404 -> 412 -> 409 DUPLICATE_NAME). PUT replaces the whole editable representation: an omitted
//   description or jiraProjectKey is stored as null.
//   failNext('PUT /applications/{id}', error) makes the next call to that operation fail once; hold(predicate) makes
//   the matching calls wait until `release()`.
import { vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';

import type { RecordedApiCall } from './fakeVariablesApi';

type Application = components['schemas']['Application'];

const WRITE_KEYS = ['name', 'description', 'platform', 'jiraProjectKey'];
const JIRA_KEY = /^[A-Z][A-Z0-9_]{1,19}$/;
export const DEPARTMENT_SCOPE = 'Documentación técnica';

function response(body: unknown, etag: string | null = null, status = 200) {
  return Promise.resolve({ body, status, etag, location: null });
}

function validation(fields: Array<{ field: string; rule: string }>) {
  return new ApiError({
    status: 400,
    code: 'VALIDATION_ERROR',
    details: { fields: fields.map((f) => ({ ...f, message: 'server text' })) },
  });
}

export function makeApplicationsApi(initial: Application[]) {
  const state = {
    applications: initial,
    /** Kept for the shape of the minimal fake of renderApp: when set, every PUT fails with it. */
    putError: null as ApiError | null,
    versions: new Map<number, number>(),
    nextId: 100,
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

  function find(id: unknown): Application {
    const found = state.applications.find((a) => a.id === id);
    if (!found) {
      throw new ApiError({ status: 404, code: 'NOT_FOUND', details: { element: 'application' } });
    }
    return found;
  }

  function checkBody(body: Record<string, unknown>, withStatus: boolean) {
    const fields: Array<{ field: string; rule: string }> = [];
    const allowed = withStatus ? [...WRITE_KEYS, 'status'] : WRITE_KEYS;
    for (const key of Object.keys(body)) {
      if (!allowed.includes(key)) fields.push({ field: key, rule: 'unevaluatedProperties' });
    }
    const { name, platform, description, jiraProjectKey, status } = body;
    if (typeof name !== 'string' || name.length < 1)
      fields.push({ field: 'name', rule: 'minLength' });
    else if (name.length > 120) fields.push({ field: 'name', rule: 'maxLength' });
    if (typeof platform !== 'string' || platform.length < 1) {
      fields.push({ field: 'platform', rule: 'minLength' });
    } else if (platform.length > 60) fields.push({ field: 'platform', rule: 'maxLength' });
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string' || description.length > 4000) {
        fields.push({ field: 'description', rule: 'maxLength' });
      }
    }
    if (jiraProjectKey !== undefined && jiraProjectKey !== null) {
      if (typeof jiraProjectKey !== 'string' || !JIRA_KEY.test(jiraProjectKey)) {
        fields.push({ field: 'jiraProjectKey', rule: 'pattern' });
      }
    }
    if (withStatus && status !== 'ACTIVE' && status !== 'ARCHIVED') {
      fields.push({ field: 'status', rule: 'enum' });
    }
    if (fields.length > 0) throw validation(fields);
  }

  function checkName(name: string, exceptId?: number) {
    if (state.applications.some((a) => a.id !== exceptId && a.name === name)) {
      throw new ApiError({
        status: 409,
        code: 'DUPLICATE_NAME',
        details: {
          field: 'name',
          type: 'application',
          name,
          application: DEPARTMENT_SCOPE,
          container: 'system',
        },
      });
    }
  }

  function list(query: Record<string, unknown>) {
    let rows = [...state.applications];
    if (typeof query.q === 'string') {
      const q = query.q.toLowerCase();
      rows = rows.filter((a) => a.name.toLowerCase().includes(q));
    }
    if (query.status) rows = rows.filter((a) => a.status === query.status);
    rows.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
    const page = (query.page as number | undefined) ?? 1;
    const pageSize = (query.pageSize as number | undefined) ?? 20;
    if (pageSize > 100) throw validation([{ field: 'pageSize', rule: 'maximum' }]);
    return {
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: rows.length,
    };
  }

  async function handle(method: string, path: string, options: RecordedApiCall['options'] = {}) {
    const call: RecordedApiCall = { method, path, options };
    calls.push(call);
    for (const held of holds) if (held.predicate(call)) await held.gate;
    const queued = failures.get(`${method} ${path}`);
    const failure = queued?.shift();
    if (failure) throw failure;

    if (method === 'GET' && path === '/applications') return response(list(options.query ?? {}));
    if (method === 'GET' && path === '/applications/{id}') {
      const found = find(options.path?.id);
      return response({ data: found }, etagOf(found.id));
    }
    if (method === 'POST' && path === '/applications') {
      const body = (options.body ?? {}) as Record<string, unknown>;
      checkBody(body, false);
      checkName(body.name as string);
      const id = state.nextId++;
      const now = new Date().toISOString();
      const created: Application = {
        id,
        name: body.name as string,
        platform: body.platform as string,
        description: (body.description as string | null | undefined) ?? null,
        jiraProjectKey: (body.jiraProjectKey as string | null | undefined) ?? null,
        status: 'ACTIVE',
        appContextScreen: { id: id * 10, name: 'App (OnStart)' },
        createdBy: { id: 7, name: 'Ana Mora' },
        createdAt: now,
        updatedAt: now,
      };
      state.applications = [...state.applications, created];
      return response({ data: created }, etagOf(id), 201);
    }
    if (method === 'PUT' && path === '/applications/{id}') {
      if (state.putError) throw state.putError;
      const body = (options.body ?? {}) as Record<string, unknown>;
      checkBody(body, true);
      const current = find(options.path?.id);
      if (options.ifMatch !== undefined && options.ifMatch !== etagOf(current.id)) {
        throw new ApiError({
          status: 412,
          code: 'PRECONDITION_FAILED',
          details: { element: 'application', currentETag: etagOf(current.id) },
        });
      }
      checkName(body.name as string, current.id);
      const updated: Application = {
        ...current,
        name: body.name as string,
        platform: body.platform as string,
        description: (body.description as string | null | undefined) ?? null,
        jiraProjectKey: (body.jiraProjectKey as string | null | undefined) ?? null,
        status: body.status as Application['status'],
        updatedAt: new Date().toISOString(),
      };
      state.applications = state.applications.map((a) => (a.id === current.id ? updated : a));
      bump(current.id);
      return response({ data: updated }, etagOf(current.id));
    }
    throw new ApiError({
      status: 404,
      code: 'NOT_FOUND',
      details: { reason: 'ROUTE_NOT_FOUND' },
    });
  }

  const get = vi.fn((path: string, options?: RecordedApiCall['options']) =>
    handle('GET', path, options),
  );
  const post = vi.fn((path: string, options?: RecordedApiCall['options']) =>
    handle('POST', path, options),
  );
  const put = vi.fn((path: string, options?: RecordedApiCall['options']) =>
    handle('PUT', path, options),
  );
  const client = { get, post, put } as unknown as ApiClient;

  const callsTo = (operation: string) =>
    calls.filter((call) => `${call.method} ${call.path}` === operation);

  return { state, get, post, put, client, calls, callsTo, failNext, hold, etagOf };
}
