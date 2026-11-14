// fakeAuditApi: in-memory fake of GET /audit-log (and the user reads the filter needs) behind the API client (no fetch).
// makeAuditApi(apps, init) -> { state, client, calls, callsTo, failNext, users }
//   init: entries (AuditEntry[], any order), role (of the signed-in user: ADMINISTRATOR | DEVELOPER | READER),
//   selfId, users (the user fake's data). It answers like the server (SDD 7.2.6, D-107) and in its order of checks:
//   403 FORBIDDEN by role for a Reader (x-roles runs before validation) -> 400 VALIDATION_ERROR (entityId without
//   entityType is `required` on entityType, a date without a zone is `format`, from after to is `range` on `to`, an
//   unknown action or entity type is `enum`, a page size over 100 is `maximum`) -> 403 FORBIDDEN with
//   details.reason OWN_ACTIONS for a Developer who asks for another user. Without `actorUserId` a Developer gets
//   their own records. Newest first (createdAt, then id, descending); from and to are inclusive; `dbRole` is only
//   sent to the Administrator. Other paths (GET /users, GET /users/{id}) go to the users fake.
//   failNext('GET /audit-log', error) makes the next READ OF THE TIMELINE fail once (the totals of the side panel ask
//   for one record, pageSize=1, and are left alone); failNext(..., error, { action }) makes the next TOTAL of that
//   action fail once instead.
import { vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';

import type { RecordedApiCall } from './fakeVariablesApi';
import { SELF_ID, makeUsersApi } from './fakeUsersApi';
import type { makeApplicationsClient } from './renderApp';

type Entry = components['schemas']['AuditEntry'];
type Role = components['schemas']['UserRole'];

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'EVENT'];
const ENTITY_TYPES = [
  'app_user',
  'application',
  'screen',
  'variable',
  'collection',
  'collection_field',
  'component',
  'element_environment',
  'screen_variable',
  'screen_collection',
  'variable_collection',
  'dependency',
  'jira_ticket',
  'comment',
  'report',
];
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export type EntryOverrides = Omit<Partial<Entry>, 'oldValue' | 'newValue'> & {
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
};

/** A record as the API serves it (an UPDATE of a screen by Ana Mora in application 1 unless said otherwise). */
export function makeEntry(id: number, overrides: EntryOverrides = {}): Entry {
  return {
    id: String(id),
    action: 'UPDATE',
    eventName: null,
    entityType: 'screen',
    entityId: '12',
    entityLabel: 'Inicio',
    applicationId: 1,
    actor: { id: SELF_ID, name: 'Ana Mora' },
    dbRole: 'docs_app',
    changedFields: [],
    oldValue: null,
    newValue: null,
    createdAt: '2026-10-05T16:21:00.000Z',
    ...overrides,
  } as Entry;
}

export interface AuditApiInit {
  entries?: Entry[];
  role?: Role;
  selfId?: number;
  users?: Parameters<typeof makeUsersApi>[1] extends infer I
    ? I extends { users?: infer U }
      ? U
      : never
    : never;
}

/** A query value as text ('' when it is not a string: the fake reads what the client serialized). */
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function response(body: unknown) {
  return Promise.resolve({ body, status: 200, etag: null, location: null });
}

function validation(fields: Array<{ field: string; rule: string }>) {
  return new ApiError({
    status: 400,
    code: 'VALIDATION_ERROR',
    details: { fields: fields.map((f) => ({ ...f, message: 'server text' })) },
  });
}

export function makeAuditApi(
  apps: ReturnType<typeof makeApplicationsClient>,
  init: AuditApiInit = {},
) {
  const selfId = init.selfId ?? SELF_ID;
  const users = makeUsersApi(apps, { users: init.users ?? [], selfId });
  const state = { entries: init.entries ?? [], role: init.role ?? 'ADMINISTRATOR', selfId };
  const calls: RecordedApiCall[] = [];
  const failures: Array<{ error: ApiError; action?: string }> = [];

  function failNext(operation: string, error: ApiError, matching?: { action: string }) {
    if (operation !== 'GET /audit-log') throw new Error('Only GET /audit-log can fail here');
    failures.push({ error, action: matching?.action });
  }

  function list(query: Record<string, unknown>) {
    if (state.role === 'READER') {
      throw new ApiError({
        status: 403,
        code: 'FORBIDDEN',
        details: { requiredRoles: ['ADMINISTRATOR', 'DEVELOPER'] },
      });
    }
    const problems: Array<{ field: string; rule: string }> = [];
    if (query.entityId !== undefined && query.entityType === undefined) {
      problems.push({ field: 'entityType', rule: 'required' });
    }
    if (query.entityType !== undefined && !ENTITY_TYPES.includes(text(query.entityType))) {
      problems.push({ field: 'entityType', rule: 'enum' });
    }
    if (query.action !== undefined && !ACTIONS.includes(text(query.action))) {
      problems.push({ field: 'action', rule: 'enum' });
    }
    for (const key of ['from', 'to'] as const) {
      const value = query[key];
      if (value !== undefined && !DATE_TIME.test(text(value))) {
        problems.push({ field: key, rule: 'format' });
      }
    }
    if (
      problems.length === 0 &&
      query.from !== undefined &&
      query.to !== undefined &&
      new Date(text(query.from)).getTime() > new Date(text(query.to)).getTime()
    ) {
      problems.push({ field: 'to', rule: 'range' });
    }
    const pageSize = (query.pageSize as number | undefined) ?? 20;
    if (pageSize > 100) problems.push({ field: 'pageSize', rule: 'maximum' });
    if (problems.length > 0) throw validation(problems);

    const actorUserId = query.actorUserId as number | undefined;
    if (state.role === 'DEVELOPER' && actorUserId !== undefined && actorUserId !== state.selfId) {
      throw new ApiError({
        status: 403,
        code: 'FORBIDDEN',
        details: { reason: 'OWN_ACTIONS' },
      });
    }
    const wantedActor = state.role === 'DEVELOPER' ? state.selfId : actorUserId;

    let rows = state.entries.filter((entry) => {
      if (query.applicationId !== undefined && entry.applicationId !== query.applicationId)
        return false;
      if (query.entityType !== undefined && entry.entityType !== query.entityType) return false;
      if (query.entityId !== undefined && entry.entityId !== query.entityId) return false;
      if (query.action !== undefined && entry.action !== query.action) return false;
      if (wantedActor !== undefined && entry.actor?.id !== wantedActor) return false;
      const at = new Date(entry.createdAt).getTime();
      if (query.from !== undefined && at < new Date(text(query.from)).getTime()) return false;
      if (query.to !== undefined && at > new Date(text(query.to)).getTime()) return false;
      return true;
    });
    rows = [...rows].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
        Number(BigInt(b.id) - BigInt(a.id)),
    );
    const page = (query.page as number | undefined) ?? 1;
    const data = rows.slice((page - 1) * pageSize, page * pageSize).map((entry) => {
      if (state.role === 'ADMINISTRATOR') return entry;
      const { dbRole, ...withoutRole } = entry;
      void dbRole;
      return withoutRole;
    });
    return { data, page, pageSize, total: rows.length };
  }

  async function handle(method: string, path: string, options: RecordedApiCall['options'] = {}) {
    if (path !== '/audit-log') {
      const client = users.client as unknown as Record<
        string,
        (p: string, o?: unknown) => Promise<unknown>
      >;
      return client[method.toLowerCase()]?.(path, options);
    }
    calls.push({ method, path, options });
    await Promise.resolve();
    const isTotal = options.query?.pageSize === 1;
    const index = failures.findIndex((f) =>
      f.action === undefined ? !isTotal : isTotal && options.query?.action === f.action,
    );
    const failure = index >= 0 ? failures.splice(index, 1)[0] : undefined;
    if (failure) throw failure.error;
    return response(list(options.query ?? {}));
  }

  const client = {
    get: vi.fn((path: string, options?: RecordedApiCall['options']) =>
      handle('GET', path, options),
    ),
  } as unknown as ApiClient;

  const callsTo = (operation: string) =>
    calls.filter((call) => `${call.method} ${call.path}` === operation);

  return { state, client, calls, callsTo, failNext, users };
}
