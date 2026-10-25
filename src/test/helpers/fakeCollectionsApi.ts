// fakeCollectionsApi: in-memory fake of the collection endpoints behind the API client (no fetch).
// makeCollectionsApi(apps, init) -> { state, client, calls, callsTo, failNext, hold, etagOf, variablesApi }
//   GET /collections (filters q, environment, undocumented, sort, page, pageSize), GET /collections/{id} (with a weak
//   ETag that moves when a write changes something), GET /collections/{id}/fields (paged, by position),
//   POST /collections, PUT /collections/{id} and DELETE /collections/{id}. Everything else (variables, screens,
//   applications) goes to the variables fake (makeVariablesApi).
//   PUT behaves like the server: If-Match is checked (412), nested items are reconciled by id (an id that is not of
//   the collection is 404 with its position, an omitted item is deleted, an item without id is created), a repeated
//   field name or assignment is 400 `unique` with its position, `self` derivations are 400, and the 422 rules run in
//   the order CROSS_APPLICATION, SCOPE_MISMATCH, CONTEXT_SCREEN_MISMATCH with `details.field`.
//   An update that changes nothing keeps the ETag.
import { vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { ApiClient } from '../../api/client';
import type {
  Collection,
  CollectionField,
  CollectionSummary,
  CollectionWrite,
  VariableAssignment,
} from '../../modules/collections/collectionTypes';

import { makeVariablesApi, type RecordedApiCall, type VariablesApiInit } from './fakeVariablesApi';
import type { makeApplicationsClient } from './renderApp';

export function makeCollection(
  id: number,
  name: string,
  overrides: Partial<Collection> = {},
): Collection {
  const fields = overrides.fields ?? [];
  return {
    id,
    applicationId: 1,
    name,
    environments: ['DEV'],
    documented: false,
    fieldCount: fields.length,
    creationCondition: null,
    description: null,
    environmentDetails: [{ environment: 'DEV', notes: null }],
    fields,
    variableAssignments: [],
    derivedFrom: [],
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    ...overrides,
  };
}

export function makeField(
  id: number,
  name: string,
  position: number,
  overrides: Partial<CollectionField> = {},
): CollectionField {
  return { id, name, dataType: 'TEXT', description: null, position, ...overrides };
}

export interface CollectionsApiInit extends VariablesApiInit {
  collections?: Collection[];
}

const SORT_KEYS = ['name', 'updatedAt'] as const;

function response(body: unknown, etag: string | null = null, status = 200) {
  return Promise.resolve({ body, status, etag, location: null });
}

function summary(collection: Collection): CollectionSummary {
  const {
    creationCondition: _condition,
    description: _description,
    environmentDetails: _details,
    fields: _fields,
    variableAssignments: _assignments,
    derivedFrom: _derived,
    ...rest
  } = collection;
  void [_condition, _description, _details, _fields, _assignments, _derived];
  return { ...rest, fieldCount: collection.fields.length };
}

function notFound(element: string, id: unknown, field?: string): ApiError {
  return new ApiError({
    status: 404,
    code: 'NOT_FOUND',
    details: { element, id, ...(field !== undefined && { field }) },
  });
}

function uniqueError(field: string): ApiError {
  return new ApiError({
    status: 400,
    code: 'VALIDATION_ERROR',
    details: { fields: [{ field, rule: 'unique', message: 'x' }] },
  });
}

export function makeCollectionsApi(
  apps: ReturnType<typeof makeApplicationsClient>,
  init: CollectionsApiInit = {},
) {
  const variablesApi = makeVariablesApi(apps, init);
  const state = {
    collections: init.collections ?? [],
    versions: new Map<number, number>(),
    nextId: 1000,
    nextNestedId: 5000,
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

  function find(id: unknown): Collection {
    const found = state.collections.find((c) => c.id === id);
    if (!found) throw notFound('collection', id);
    return found;
  }

  function listCollections(query: Record<string, unknown>) {
    let rows = state.collections.filter((c) => c.applicationId === query.applicationId);
    if (typeof query.q === 'string') {
      const q = query.q.toLowerCase();
      rows = rows.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (query.environment) {
      rows = rows.filter((c) => c.environments.includes(query.environment as 'DEV' | 'PROD'));
    }
    if (query.undocumented === true) rows = rows.filter((c) => !c.documented);
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

  /** The rules of a write that do not depend on the current state, and the 404 / 422 ones that do. */
  function checkWrite(body: CollectionWrite, current: Collection | null, applicationId: number) {
    const fields = body.fields ?? [];
    const assignments = body.variableAssignments ?? [];
    const derivedFrom = body.derivedFrom ?? [];
    const seenNames = new Set<string>();
    fields.forEach((field, index) => {
      if (seenNames.has(field.name)) throw uniqueError(`fields[${index}].name`);
      seenNames.add(field.name);
    });
    const seenAssignments = new Set<string>();
    assignments.forEach((assignment, index) => {
      const key = `${assignment.variableId}|${assignment.screenId}|${assignment.usedIn}`;
      if (seenAssignments.has(key)) throw uniqueError(`variableAssignments[${index}]`);
      seenAssignments.add(key);
    });
    const seenDerived = new Set<number>();
    derivedFrom.forEach((id, index) => {
      if (current !== null && id === current.id)
        throw new ApiError({
          status: 400,
          code: 'VALIDATION_ERROR',
          details: { fields: [{ field: `derivedFrom[${index}]`, rule: 'self', message: 'x' }] },
        });
      if (seenDerived.has(id)) throw uniqueError(`derivedFrom[${index}]`);
      seenDerived.add(id);
    });
    // 404: ids of nested items that are not of this collection, and references that do not exist.
    fields.forEach((field, index) => {
      if (field.id !== undefined && !current?.fields.some((f) => f.id === field.id))
        throw notFound('collection field', field.id, `fields[${index}].id`);
    });
    assignments.forEach((assignment, index) => {
      if (
        assignment.id !== undefined &&
        !current?.variableAssignments.some((a) => a.id === assignment.id)
      )
        throw notFound('variable assignment', assignment.id, `variableAssignments[${index}].id`);
    });
    assignments.forEach((assignment, index) => {
      if (!variablesApi.state.variables.some((v) => v.id === assignment.variableId))
        throw notFound(
          'variable',
          assignment.variableId,
          `variableAssignments[${index}].variableId`,
        );
      if (!variablesApi.state.screens.some((s) => s.id === assignment.screenId))
        throw notFound('screen', assignment.screenId, `variableAssignments[${index}].screenId`);
    });
    derivedFrom.forEach((id, index) => {
      if (!state.collections.some((c) => c.id === id))
        throw notFound('collection', id, `derivedFrom[${index}]`);
    });
    // 422, rule by rule, each from the first item to the last (D-76).
    const rule = (field: string, code: string, details: Record<string, unknown> = {}) =>
      new ApiError({ status: 422, code, details: { field, ...details } });
    assignments.forEach((assignment, index) => {
      const variable = variablesApi.state.variables.find((v) => v.id === assignment.variableId);
      const screen = variablesApi.state.screens.find((s) => s.id === assignment.screenId);
      if (variable?.applicationId !== applicationId)
        throw rule(`variableAssignments[${index}].variableId`, 'CROSS_APPLICATION');
      if (screen?.applicationId !== applicationId)
        throw rule(`variableAssignments[${index}].screenId`, 'CROSS_APPLICATION');
    });
    derivedFrom.forEach((id, index) => {
      if (state.collections.find((c) => c.id === id)?.applicationId !== applicationId)
        throw rule(`derivedFrom[${index}]`, 'CROSS_APPLICATION');
    });
    assignments.forEach((assignment, index) => {
      const variable = variablesApi.state.variables.find((v) => v.id === assignment.variableId);
      const fits =
        variable?.scope === 'GLOBAL'
          ? assignment.assignmentFunction === 'SET'
          : assignment.assignmentFunction === 'UPDATE_CONTEXT';
      if (!fits) throw rule(`variableAssignments[${index}].assignmentFunction`, 'SCOPE_MISMATCH');
    });
    assignments.forEach((assignment, index) => {
      const variable = variablesApi.state.variables.find((v) => v.id === assignment.variableId);
      if (variable?.scope !== 'CONTEXT') return;
      if (variable.originScreen?.id !== assignment.screenId) {
        throw rule(`variableAssignments[${index}].screenId`, 'CONTEXT_SCREEN_MISMATCH', {
          variableId: variable.id,
          variable: variable.name,
          originScreenId: variable.originScreen?.id ?? null,
          screen: variable.originScreen?.name,
        });
      }
    });
  }

  function applicationName(applicationId: number): string {
    return apps.state.applications.find((a) => a.id === applicationId)?.name ?? 'the application';
  }

  function checkName(body: CollectionWrite, applicationId: number, exceptId: number | null) {
    if (
      state.collections.some(
        (c) => c.applicationId === applicationId && c.name === body.name && c.id !== exceptId,
      )
    ) {
      throw new ApiError({
        status: 409,
        code: 'DUPLICATE_NAME',
        details: {
          field: 'name',
          type: 'collection',
          name: body.name,
          application: applicationName(applicationId),
          container: 'application',
        },
      });
    }
  }

  function build(body: CollectionWrite, base: Collection): Collection {
    const nested = () => state.nextNestedId++;
    const fields = (body.fields ?? []).map((field, index) => ({
      id: field.id ?? nested(),
      name: field.name,
      dataType: field.dataType,
      description: field.description ?? null,
      position: field.position ?? index,
    }));
    const assignments: VariableAssignment[] = (body.variableAssignments ?? []).map((assignment) => {
      const variable = variablesApi.state.variables.find((v) => v.id === assignment.variableId);
      const screen = variablesApi.state.screens.find((s) => s.id === assignment.screenId);
      return {
        id: assignment.id ?? nested(),
        variable: { id: assignment.variableId, name: variable?.name ?? '' },
        collection: { id: base.id, name: body.name },
        screen: { id: assignment.screenId, name: screen?.name ?? '' },
        assignmentFunction: assignment.assignmentFunction,
        tableFunction: assignment.tableFunction ?? null,
        usedIn: assignment.usedIn,
      };
    });
    return {
      ...base,
      name: body.name,
      creationCondition: body.creationCondition ?? null,
      description: body.description ?? null,
      environments: body.environments.map((e) => e.environment),
      environmentDetails: body.environments.map((e) => ({
        environment: e.environment,
        notes: e.notes ?? null,
      })),
      fields: [...fields].sort((a, b) => a.position - b.position || a.id - b.id),
      fieldCount: fields.length,
      variableAssignments: assignments,
      derivedFrom: (body.derivedFrom ?? []).map((id) => ({
        id,
        name: state.collections.find((c) => c.id === id)?.name ?? '',
      })),
    };
  }

  const comparable = (collection: Collection) => {
    const { updatedAt: _updatedAt, ...rest } = collection;
    void _updatedAt;
    return JSON.stringify(rest);
  };

  async function handle(method: string, path: string, options: RecordedApiCall['options'] = {}) {
    if (!path.startsWith('/collections')) {
      const fallback = variablesApi.client as unknown as Record<
        string,
        (p: string, o?: unknown) => Promise<unknown>
      >;
      return fallback[method.toLowerCase()]?.(path, options);
    }
    const call: RecordedApiCall = { method, path, options };
    calls.push(call);
    for (const held of holds) if (held.predicate(call)) await held.gate;
    const queued = failures.get(`${method} ${path}`);
    const failure = queued?.shift();
    if (failure) throw failure;
    const query = options.query ?? {};

    if (method === 'GET' && path === '/collections') return response(listCollections(query));
    if (method === 'GET' && path === '/collections/{id}') {
      const collection = find(options.path?.id);
      return response({ data: collection }, etagOf(collection.id));
    }
    if (method === 'GET' && path === '/collections/{id}/fields') {
      const collection = find(options.path?.id);
      const page = (query.page as number | undefined) ?? 1;
      const pageSize = (query.pageSize as number | undefined) ?? 100;
      const rows = [...collection.fields].sort((a, b) => a.position - b.position || a.id - b.id);
      return response({
        data: rows.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: rows.length,
      });
    }
    if (method === 'POST' && path === '/collections') {
      const body = options.body as CollectionWrite & { applicationId: number };
      checkWrite(body, null, body.applicationId);
      checkName(body, body.applicationId, null);
      const id = state.nextId++;
      const created = build(
        body,
        makeCollection(id, body.name, { applicationId: body.applicationId }),
      );
      state.collections = [...state.collections, created];
      return response({ data: created }, etagOf(id), 201);
    }
    if (method === 'PUT' && path === '/collections/{id}') {
      const current = find(options.path?.id);
      const body = options.body as CollectionWrite;
      checkWrite(body, current, current.applicationId);
      if (options.ifMatch !== undefined && options.ifMatch !== etagOf(current.id)) {
        throw new ApiError({
          status: 412,
          code: 'PRECONDITION_FAILED',
          details: { element: 'collection', currentETag: etagOf(current.id) },
        });
      }
      checkName(body, current.applicationId, current.id);
      const built = build(body, current);
      if (comparable(built) !== comparable(current)) {
        const updated = { ...built, updatedAt: new Date().toISOString() };
        state.collections = state.collections.map((c) => (c.id === current.id ? updated : c));
        bump(current.id);
      }
      return response({ data: find(current.id) }, etagOf(current.id));
    }
    if (method === 'DELETE' && path === '/collections/{id}') {
      const current = find(options.path?.id);
      state.collections = state.collections.filter((c) => c.id !== current.id);
      return response(null, null, 204);
    }
    throw new Error(`fakeCollectionsApi: unhandled ${method} ${path}`);
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

  return { state, client, calls, callsTo, failNext, hold, etagOf, variablesApi };
}
