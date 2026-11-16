// renderApp: renders the real route table (appRoutes) in a memory router with a real SessionManager over the
// fake backend, the real ApplicationProvider over a fake API client and the ToastProvider.
// Options: role (of the signed-in user), path (initial URL), signedIn (false: no session cookie), applications
// (what GET /applications returns), applicationsApi (replaces the applications fake), buildClient (replaces the API client of the pages, e.g. makeVariablesApi), now (system time, when the test uses fake timers), sessionExpiresIn.
// Ends with settle() (unless `settled: false`): the page is rendered when it returns. Returns { router, manager, backend, apps, client }; `apps` records the calls of the application API and `client`
// is the client the pages use (the applications fake unless buildClient is given).
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';

import { appRoutes } from '../../app/router/router';
import { preloadPage } from '../../app/router/preloadPage';
import type { Role } from '../../app/router/routes';
import type { ApiError } from '../../api/ApiError';
import type { ApiClient } from '../../api/client';
import { ApiContext } from '../../api/useApi';
import { ApplicationProvider } from '../../application/ApplicationProvider';
import type { Application } from '../../application/ApplicationContext';
import { ToastProvider } from '../../components/ui';
import { SessionManager } from '../../session/SessionManager';
import { SessionProvider } from '../../session/SessionProvider';

import { FakeBackend, FakeLocks, TEST_USER } from './fakeBackend';
import { settle } from './setupUser';

export const PASSWORD = 'right-password';

export function makeApplication(id: number, overrides: Partial<Application> = {}): Application {
  return {
    id,
    name: `App ${id}`,
    platform: 'Power Apps',
    description: 'Sample description',
    jiraProjectKey: 'TECHEA',
    status: 'ACTIVE',
    appContextScreen: { id: id * 10, name: 'App' },
    createdBy: { id: 1, name: 'Admin' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Fake of the application endpoints. `putError` makes PUT /applications/{id} fail. */
export function makeApplicationsClient(initial: Application[]) {
  const state = { applications: initial, putError: null as ApiError | null };
  const get = vi.fn((path: string, options?: { path?: { id: number } }) => {
    if (path === '/applications') {
      return Promise.resolve({
        body: {
          data: state.applications,
          page: 1,
          pageSize: 100,
          total: state.applications.length,
        },
        status: 200,
        etag: null,
        location: null,
      });
    }
    const found = state.applications.find((a) => a.id === options?.path?.id);
    return Promise.resolve({ body: { data: found }, status: 200, etag: 'W/"7"', location: null });
  });
  const put = vi.fn(
    (_path: string, options?: { path?: { id: number }; body?: Partial<Application> }) => {
      if (state.putError) return Promise.reject(state.putError);
      state.applications = state.applications.map((a) =>
        a.id === options?.path?.id ? { ...a, ...options?.body } : a,
      );
      return Promise.resolve({ body: {}, status: 200, etag: 'W/"8"', location: null });
    },
  );
  return { state, get, put, client: { get, put } as unknown as ApiClient };
}

export interface RenderAppOptions {
  role?: Role;
  path?: string;
  signedIn?: boolean;
  applications?: Application[];
  /** Replaces the minimal applications fake (fakeApplicationsApi, for the tests of the applications themselves). */
  applicationsApi?: ReturnType<typeof makeApplicationsClient>;
  /** Builds the client the pages use (ApiContext); the applications keep their own fake. */
  buildClient?: (apps: ReturnType<typeof makeApplicationsClient>) => ApiClient;
  sessionExpiresIn?: number;
  name?: string;
  /** false: return before React renders what the first reads brought, to look at a state that is still in flight. */
  settled?: boolean;
}

export async function renderApp(options: RenderAppOptions = {}) {
  const { role = 'ADMINISTRATOR', path = '/dashboard', signedIn = true } = options;
  localStorage.clear();
  const backend = new FakeBackend({ sessionExpiresIn: options.sessionExpiresIn });
  backend.user = { ...TEST_USER, role, name: options.name ?? TEST_USER.name };
  backend.install();
  const manager = new SessionManager({ lock: new FakeLocks(), createChannel: () => null });
  if (signedIn) await manager.login(TEST_USER.email, PASSWORD);
  const apps =
    options.applicationsApi ??
    makeApplicationsClient(options.applications ?? [makeApplication(1, { name: 'SAR' })]);
  const pageClient = options.buildClient?.(apps) ?? apps.client;
  // The routes of /audit, /search and /dependency-map load their code when opened. The first import in a cold worker
  // can take longer than the 1 s of findBy, so the page of `path` (and the two light ones a test reaches by a link,
  // which used to be in the main bundle) are loaded first: the wait is for the work, not for the clock.
  await Promise.all(
    [path.split(/[?#]/)[0] ?? path, '/search', '/audit'].map((pathname) => preloadPage(pathname)),
  );
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });

  const view = render(
    <SessionProvider manager={manager}>
      <ApplicationProvider client={apps.client}>
        <ApiContext value={pageClient}>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </ApiContext>
      </ApplicationProvider>
    </SessionProvider>,
  );
  // Everything the first reads brought is rendered before the test looks at the page: what it checks does not depend
  // on when React decides to render (see setupUser.ts).
  if (options.settled !== false) await settle();
  return { router, manager, backend, apps, client: pageClient, ...view };
}
