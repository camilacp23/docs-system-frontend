// renderUsers: renderApp over the in-memory users API (fakeUsersApi) with the sample data of the frames S-02 to S-06b:
// the signed-in administrator (id 7, "Ana Mora"), Sample Admin, Sample Developer A and B, Sample Reader, the inactive
// Former Developer and the reserved account (which the API never lists). Options: role (of the signed-in user),
// path, applications, plus `users` to replace the sample data, `prepare` to arm failures or holds before the first
// read. Returns what renderApp returns plus `api`.
import type { Application } from '../../application/ApplicationContext';
import type { Role } from '../../app/router/routes';

import { RESERVED_USER_ID, SELF_ID, makeUser, makeUsersApi } from './fakeUsersApi';
import { renderApp } from './renderApp';
import { settle } from './setupUser';

export function sampleUsers() {
  return [
    makeUser(SELF_ID, 'Ana Mora', {
      email: 'ana.mora@dept.local',
      role: 'ADMINISTRATOR',
      lastLoginAt: '2026-10-05T08:02:00',
      createdAt: '2026-09-20T09:00:00',
    }),
    makeUser(2, 'Sample Admin', {
      email: 'admin.sample@example.com',
      role: 'ADMINISTRATOR',
      lastLoginAt: '2026-10-04T16:21:00',
      createdAt: '2026-09-20T09:00:00',
    }),
    makeUser(3, 'Sample Developer A', {
      email: 'dev.a@example.com',
      lastLoginAt: '2026-10-05T07:45:00',
      createdAt: '2026-09-22T09:00:00',
    }),
    makeUser(4, 'Sample Developer B', {
      email: 'dev.b@example.com',
      lastLoginAt: null,
      createdAt: '2026-10-01T09:00:00',
    }),
    makeUser(5, 'Sample Reader', {
      email: 'reader@example.com',
      role: 'READER',
      lastLoginAt: '2026-10-02T13:10:00',
      createdAt: '2026-09-25T09:00:00',
    }),
    makeUser(6, 'Former Developer', {
      email: 'former.dev@example.com',
      status: 'INACTIVE',
      lastLoginAt: '2026-09-28T17:30:00',
      createdAt: '2026-09-22T09:00:00',
    }),
    makeUser(RESERVED_USER_ID, 'Integración Jira', {
      email: 'integracion.jira@system.local',
      role: 'READER',
      status: 'INACTIVE',
      lastLoginAt: null,
    }),
  ];
}

export interface RenderUsersOptions {
  role?: Role;
  path?: string;
  applications?: Application[];
  users?: ReturnType<typeof sampleUsers>;
  /** Runs on the fake API before the first render, to arm failures or holds for the first reads. */
  prepare?: (api: ReturnType<typeof makeUsersApi>) => void;
}

export async function renderUsers(options: RenderUsersOptions = {}) {
  let api: ReturnType<typeof makeUsersApi> | undefined;
  const view = await renderApp({
    role: options.role ?? 'ADMINISTRATOR',
    path: options.path ?? '/admin/users',
    applications: options.applications,
    buildClient: (apps) => {
      api = makeUsersApi(apps, { users: options.users ?? sampleUsers() });
      options.prepare?.(api);
      return api.client;
    },
  });
  if (api === undefined) throw new Error('buildClient was not called');
  // Let React render what the first reads brought, so the tests do not depend on when it decides to.
  await settle();
  return { ...view, api };
}
