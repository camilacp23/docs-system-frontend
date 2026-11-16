// Route table (D-57) and the browser router.
// /login is outside the shell. Everything else needs a session (RequireAuth), is drawn inside AppShell and is
// checked against the role of the user (RoleGate -> S-41b). "/" goes to /dashboard; an unknown path shows S-41a.
// Modules that do not exist yet are ModulePlaceholder pages. /audit, /search and /dependency-map are loaded when their
// route is opened (lazyPages.tsx); the three modules still to come use the same pattern. appRoutes is exported so tests can build a memory router.
import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { AppShell } from '../../layout/AppShell';
import { LoginPage } from '../../modules/auth/LoginPage';
import { DashboardPage } from '../../modules/dashboard/DashboardPage';
import { NotFoundPage, ServerErrorPage } from '../../modules/errors/ErrorPages';
import { ModulePlaceholder } from '../../modules/ModulePlaceholder';
import { CollectionEditPage } from '../../modules/collections/CollectionEditPage';
import { CollectionDetailPage } from '../../modules/collections/CollectionDetailPage';
import { CollectionsListPage } from '../../modules/collections/CollectionsListPage';
import { ApplicationsListPage } from '../../modules/applications/ApplicationsListPage';
import { UsersListPage } from '../../modules/users/UsersListPage';
import { ScreenDetailPage } from '../../modules/screens/ScreenDetailPage';
import { ScreenEditPage } from '../../modules/screens/ScreenEditPage';
import { ScreensListPage } from '../../modules/screens/ScreensListPage';
import { VariableEditPage } from '../../modules/variables/VariableEditPage';
import { VariableDetailPage } from '../../modules/variables/VariableDetailPage';
import { VariablesListPage } from '../../modules/variables/VariablesListPage';
import { RootError, RootLayout } from './RootLayout';

import { devRoutes } from './devRoutes';
import { GuestOnly, RequireAuth, RoleGate } from './guards';
import { AuditLogPage, DependencyMapPage, SearchPage } from './lazyPages';
import { APP_ROUTES, HOME_PATH, LOGIN_PATH } from './routes';

/** The pages that already exist, by route path; every other route shows the placeholder of its module. */
const PAGES: Record<string, ReactNode> = {
  '/dashboard': <DashboardPage />,
  '/variables': <VariablesListPage />,
  '/variables/:id': <VariableDetailPage />,
  '/variables/:id/edit': <VariableEditPage />,
  '/collections': <CollectionsListPage />,
  '/collections/:id': <CollectionDetailPage />,
  '/collections/:id/edit': <CollectionEditPage />,
  '/dependency-map': <DependencyMapPage />,
  '/screens': <ScreensListPage />,
  '/screens/:id': <ScreenDetailPage />,
  '/screens/:id/edit': <ScreenEditPage />,
  '/search': <SearchPage />,
  '/audit': <AuditLogPage />,
  '/admin/users': <UsersListPage />,
  '/admin/applications': <ApplicationsListPage />,
};

const pageRoutes: RouteObject[] = APP_ROUTES.map((route) => ({
  path: route.path,
  element: <RoleGate>{PAGES[route.path] ?? <ModulePlaceholder title={route.title} />}</RoleGate>,
}));

export const appRoutes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RootError />,
    children: [
      {
        path: LOGIN_PATH,
        element: (
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        ),
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                // A page that throws renders its error inside the shell (S-41c).
                errorElement: <ServerErrorPage />,
                children: [
                  { path: '/', element: <Navigate to={HOME_PATH} replace /> },
                  ...pageRoutes,
                  { path: '*', element: <NotFoundPage /> },
                ],
              },
            ],
          },
        ],
      },
      ...devRoutes,
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
