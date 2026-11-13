// fakeUsersApi: in-memory fake of the user endpoints behind the API client (no fetch).
// makeUsersApi(apps, init) -> { state, client, calls, callsTo, failNext, hold, etagOf }
//   GET /users (q on name and email, role, status, sort name | email | createdAt | lastLoginAt, page, pageSize),
//   POST /users, GET /users/{id}, PUT /users/{id}, DELETE /users/{id}, PUT /users/{id}/role. It answers like the
//   server (SDD 7.2.1): the reserved account is never listed and answers 404 on GET, 422 RESERVED_ACCOUNT on writes;
//   writes on a user are checked in the order 400 -> 404 -> 422 RESERVED_ACCOUNT -> 412 -> 422 business rules
//   (CANNOT_DEACTIVATE_SELF, LAST_ACTIVE_ADMIN) -> 409 EMAIL_TAKEN. The password policy is the contract's pattern.
//   Changing a password, deactivating a user or changing a role revokes their sessions (`state.revoked` records the
//   ids); a role change to the same role changes nothing and revokes nothing. `selfId` is the signed-in user.
//   failNext('PUT /users/{id}', error) makes the next call to that operation fail once; hold(predicate) makes the
//   matching calls wait until `release()`. Other paths fall back to the applications fake.
import { vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';

import type { RecordedApiCall } from './fakeVariablesApi';
import type { makeApplicationsClient } from './renderApp';

type User = components['schemas']['User'];
type Role = User['role'];

export const RESERVED_USER_ID = 99;
export const SELF_ID = 7;
const ROLES: readonly string[] = ['ADMINISTRATOR', 'DEVELOPER', 'READER'];
const SORT_KEYS = ['name', 'email', 'createdAt', 'lastLoginAt'] as const;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{12,128}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function makeUser(id: number, name: string, overrides: Partial<User> = {}): User {
  return {
    id,
    name,
    email: `${name.toLowerCase().replaceAll(' ', '.')}@example.com`,
    role: 'DEVELOPER',
    status: 'ACTIVE',
    lastLoginAt: '2026-10-05T08:02:00',
    createdAt: '2026-09-20T09:00:00',
    updatedAt: '2026-10-03T11:20:00',
    ...overrides,
  };
}

export interface UsersApiInit {
  users?: User[];
  selfId?: number;
}

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

export function makeUsersApi(
  apps: ReturnType<typeof makeApplicationsClient>,
  init: UsersApiInit = {},
) {
  const state = {
    users: init.users ?? [],
    selfId: init.selfId ?? SELF_ID,
    versions: new Map<number, number>(),
    revoked: [] as number[],
    nextId: 1000,
  };
  const calls: RecordedApiCall[] = [];
  const failures = new Map<string, ApiError[]>();
  const holds: Array<{ predicate: (call: RecordedApiCall) => boolean; gate: Promise<void> }> = [];

  const etagOf = (id: number) => `W/"${state.versions.get(id) ?? 1}"`;
  const bump = (id: number) => state.versions.set(id, (state.versions.get(id) ?? 1) + 1);
  const touch = (id: number) => {
    bump(id);
    return new Date().toISOString();
  };

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

  const notFound = () =>
    new ApiError({ status: 404, code: 'NOT_FOUND', details: { element: 'user' } });
  const reserved = () => new ApiError({ status: 422, code: 'RESERVED_ACCOUNT' });

  /** The user, or 404. The reserved account answers 404 on reads, as if it did not exist. */
  function find(id: unknown): User {
    const found = state.users.find((u) => u.id === id);
    if (!found) throw notFound();
    return found;
  }

  function findForWrite(id: unknown): User {
    return find(id);
  }

  const activeAdmins = () =>
    state.users.filter(
      (u) => u.role === 'ADMINISTRATOR' && u.status === 'ACTIVE' && u.id !== RESERVED_USER_ID,
    );
  const isLastActiveAdmin = (user: User) => {
    const admins = activeAdmins();
    return admins.length === 1 && admins[0]?.id === user.id;
  };
  const emailTaken = (email: string, exceptId?: number) =>
    state.users.some(
      (u) => u.id !== exceptId && u.email.toLowerCase() === email.trim().toLowerCase(),
    );

  function listUsers(query: Record<string, unknown>) {
    let rows = state.users.filter((u) => u.id !== RESERVED_USER_ID);
    if (typeof query.q === 'string') {
      const q = query.q.toLowerCase();
      rows = rows.filter((u) => u.name.toLowerCase().includes(q) || u.email.includes(q));
    }
    if (query.role) rows = rows.filter((u) => u.role === query.role);
    if (query.status) rows = rows.filter((u) => u.status === query.status);
    const sort = typeof query.sort === 'string' ? query.sort : 'name';
    const key = sort.replace(/^-/, '') as (typeof SORT_KEYS)[number];
    if (!SORT_KEYS.includes(key)) throw validation([{ field: 'sort', rule: 'enum' }]);
    rows = [...rows].sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')));
    if (sort.startsWith('-')) rows.reverse();
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

  function checkPasswordFields(password: unknown, fields: Array<{ field: string; rule: string }>) {
    if (typeof password !== 'string') {
      fields.push({ field: 'password', rule: 'type' });
      return;
    }
    if (password.length < 12) fields.push({ field: 'password', rule: 'minLength' });
    if (password.length > 128) fields.push({ field: 'password', rule: 'maxLength' });
    if (!PASSWORD_PATTERN.test(password)) fields.push({ field: 'password', rule: 'pattern' });
  }

  function checkCommon(
    body: Record<string, unknown>,
    fields: Array<{ field: string; rule: string }>,
  ) {
    const name = body.name;
    if (typeof name !== 'string' || name.length < 1)
      fields.push({ field: 'name', rule: 'minLength' });
    else if (name.length > 120) fields.push({ field: 'name', rule: 'maxLength' });
    const email = body.email;
    if (typeof email !== 'string' || !EMAIL_PATTERN.test(email)) {
      fields.push({ field: 'email', rule: 'format' });
    } else if (email.length > 254) fields.push({ field: 'email', rule: 'maxLength' });
  }

  async function handle(method: string, path: string, options: RecordedApiCall['options'] = {}) {
    const call: RecordedApiCall = { method, path, options };
    calls.push(call);
    for (const held of holds) if (held.predicate(call)) await held.gate;
    const queued = failures.get(`${method} ${path}`);
    const failure = queued?.shift();
    if (failure) throw failure;

    if (method === 'GET' && path === '/users') return response(listUsers(options.query ?? {}));

    if (method === 'POST' && path === '/users') {
      const body = (options.body ?? {}) as Record<string, unknown>;
      const fields: Array<{ field: string; rule: string }> = [];
      checkCommon(body, fields);
      checkPasswordFields(body.password, fields);
      if (typeof body.role !== 'string' || !ROLES.includes(body.role)) {
        fields.push({ field: 'role', rule: 'enum' });
      }
      if (fields.length > 0) throw validation(fields);
      if (emailTaken(body.email as string))
        throw new ApiError({ status: 409, code: 'EMAIL_TAKEN' });
      const id = state.nextId++;
      const created = makeUser(id, body.name as string, {
        email: (body.email as string).toLowerCase(),
        role: body.role as Role,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      state.users = [...state.users, created];
      return response({ data: created }, etagOf(id), 201);
    }

    if (method === 'GET' && path === '/users/{id}') {
      const user = find(options.path?.id);
      if (user.id === RESERVED_USER_ID) throw notFound();
      return response({ data: user }, etagOf(user.id));
    }

    if (method === 'PUT' && path === '/users/{id}') {
      const body = (options.body ?? {}) as Record<string, unknown>;
      const fields: Array<{ field: string; rule: string }> = [];
      checkCommon(body, fields);
      if (body.status !== 'ACTIVE' && body.status !== 'INACTIVE') {
        fields.push({ field: 'status', rule: 'enum' });
      }
      if (body.password !== undefined) checkPasswordFields(body.password, fields);
      if (fields.length > 0) throw validation(fields);
      const current = findForWrite(options.path?.id);
      if (current.id === RESERVED_USER_ID) throw reserved();
      if (options.ifMatch !== undefined && options.ifMatch !== etagOf(current.id)) {
        throw new ApiError({
          status: 412,
          code: 'PRECONDITION_FAILED',
          details: { element: 'user', currentETag: etagOf(current.id) },
        });
      }
      const deactivating = body.status === 'INACTIVE' && current.status === 'ACTIVE';
      if (deactivating && current.id === state.selfId) {
        throw new ApiError({ status: 422, code: 'CANNOT_DEACTIVATE_SELF' });
      }
      if (deactivating && isLastActiveAdmin(current)) {
        throw new ApiError({ status: 422, code: 'LAST_ACTIVE_ADMIN' });
      }
      if (emailTaken(body.email as string, current.id)) {
        throw new ApiError({ status: 409, code: 'EMAIL_TAKEN' });
      }
      const updated: User = {
        ...current,
        name: body.name as string,
        email: (body.email as string).toLowerCase(),
        status: body.status as User['status'],
        updatedAt: touch(current.id),
      };
      state.users = state.users.map((u) => (u.id === current.id ? updated : u));
      if (deactivating || body.password !== undefined) state.revoked.push(current.id);
      return response({ data: updated }, etagOf(current.id));
    }

    if (method === 'DELETE' && path === '/users/{id}') {
      const current = find(options.path?.id);
      if (current.id === RESERVED_USER_ID) throw reserved();
      if (current.id === state.selfId) {
        throw new ApiError({ status: 422, code: 'CANNOT_DEACTIVATE_SELF' });
      }
      if (current.status === 'ACTIVE' && isLastActiveAdmin(current)) {
        throw new ApiError({ status: 422, code: 'LAST_ACTIVE_ADMIN' });
      }
      if (current.status === 'ACTIVE') {
        state.users = state.users.map((u) =>
          u.id === current.id ? { ...u, status: 'INACTIVE', updatedAt: touch(u.id) } : u,
        );
        state.revoked.push(current.id);
      }
      return response(null, null, 204);
    }

    if (method === 'PUT' && path === '/users/{id}/role') {
      const body = (options.body ?? {}) as Record<string, unknown>;
      if (typeof body.role !== 'string' || !ROLES.includes(body.role)) {
        throw validation([{ field: 'role', rule: 'enum' }]);
      }
      const current = find(options.path?.id);
      if (current.id === RESERVED_USER_ID) throw reserved();
      if (current.role === body.role) return response({ data: current }, etagOf(current.id));
      if (
        body.role !== 'ADMINISTRATOR' &&
        current.status === 'ACTIVE' &&
        isLastActiveAdmin(current)
      ) {
        throw new ApiError({ status: 422, code: 'LAST_ACTIVE_ADMIN' });
      }
      const updated: User = { ...current, role: body.role as Role, updatedAt: touch(current.id) };
      state.users = state.users.map((u) => (u.id === current.id ? updated : u));
      state.revoked.push(current.id);
      return response({ data: updated }, etagOf(current.id));
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
