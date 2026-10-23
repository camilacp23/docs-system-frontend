// routes: the route table of D-57 with the roles that may open each one (SDD Table 56) and the page title shown in
// the breadcrumb. This is for usability only: the API enforces every permission (NFR-03).
// canAccessPath(role, pathname) -> true | false | null (null: not a known route, the "not found" page applies).
// Detail routes (/screens/:id ...) share the title of their list: the breadcrumb shows only the section.
import { matchPath } from 'react-router';

import type { components } from '../../api/schema';

export type Role = components['schemas']['UserRole'];

export const ROLE_LABEL: Record<Role, string> = {
  ADMINISTRATOR: 'Administrator',
  DEVELOPER: 'Developer',
  READER: 'Reader',
};

export interface AppRoute {
  path: string;
  title: string;
  roles: readonly Role[];
}

const EVERY_ROLE: readonly Role[] = ['ADMINISTRATOR', 'DEVELOPER', 'READER'];
/** Everyone but the Reader (Table 56: Review and Audit log are hidden from the Reader). */
const NOT_READER: readonly Role[] = ['ADMINISTRATOR', 'DEVELOPER'];
const ADMIN_ONLY: readonly Role[] = ['ADMINISTRATOR'];

export const LOGIN_PATH = '/login';
export const HOME_PATH = '/dashboard';

export const APP_ROUTES: readonly AppRoute[] = [
  { path: '/dashboard', title: 'Dashboard', roles: EVERY_ROLE },
  { path: '/screens', title: 'Screens', roles: EVERY_ROLE },
  { path: '/screens/:id', title: 'Screens', roles: EVERY_ROLE },
  { path: '/variables', title: 'Variables', roles: EVERY_ROLE },
  { path: '/variables/:id', title: 'Variables', roles: EVERY_ROLE },
  { path: '/collections', title: 'Collections', roles: EVERY_ROLE },
  { path: '/collections/:id', title: 'Collections', roles: EVERY_ROLE },
  { path: '/dependency-map', title: 'Dependency map', roles: EVERY_ROLE },
  { path: '/search', title: 'Advanced search', roles: EVERY_ROLE },
  { path: '/reports', title: 'Reports', roles: EVERY_ROLE },
  { path: '/onboarding', title: 'Onboarding', roles: EVERY_ROLE },
  { path: '/review', title: 'Review', roles: NOT_READER },
  { path: '/audit', title: 'Audit log', roles: NOT_READER },
  { path: '/admin/users', title: 'Users & roles', roles: ADMIN_ONLY },
  { path: '/admin/applications', title: 'Applications', roles: ADMIN_ONLY },
];

export function findRoute(pathname: string): AppRoute | null {
  return APP_ROUTES.find((route) => matchPath({ path: route.path, end: true }, pathname)) ?? null;
}

export function canAccessPath(role: Role, pathname: string): boolean | null {
  const route = findRoute(pathname);
  return route === null ? null : route.roles.includes(role);
}
