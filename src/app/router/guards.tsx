// Route guards (usability only: the API enforces permissions, NFR-03).
// RequireAuth (layout route): no session -> /login remembering the destination; while the session is being
//   recovered it shows a loading state and does not redirect; when the session ended (S-43b) it keeps the page
//   so the "Your session ended" dialog shows over it.
// GuestOnly (props: children): /login with a session -> the remembered destination or /dashboard.
// RoleGate (props: children): the role of the user must be allowed on the current path, else S-41b (in the shell).
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { ErrorState } from '../../components/ui';
import { LoadingScreen } from '../../layout/LoadingScreen';
import { NoAccessPage } from '../../modules/errors/ErrorPages';
import { useCurrentUser } from '../../session/useCurrentUser';
import { useSession } from '../../session/useSession';

import { destinationOf, readDestination, type LoginRouteState } from './destination';
import { HOME_PATH, LOGIN_PATH, canAccessPath } from './routes';

export function RequireAuth() {
  const { status, endReason, bootstrapError, retryBootstrap } = useSession();
  const user = useCurrentUser();
  const location = useLocation();

  if (status === 'initializing') return <LoadingScreen />;
  if (user !== null) return <Outlet />;
  if (status === 'unavailable') {
    return (
      <main className="flex min-h-screen flex-col bg-canvas">
        <ErrorState
          variant="server-error"
          requestId={bootstrapError?.requestId ?? undefined}
          className="flex-1"
          onAction={() => void retryBootstrap()}
        />
      </main>
    );
  }
  const state: LoginRouteState | undefined =
    endReason === 'logout' ? undefined : { from: destinationOf(location) };
  return <Navigate to={LOGIN_PATH} replace state={state} />;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { status, user } = useSession();
  const location = useLocation();
  if (status === 'initializing') return <LoadingScreen />;
  if (status === 'authenticated' && user !== null) {
    return <Navigate to={readDestination(location.state) ?? HOME_PATH} replace />;
  }
  return children;
}

export function RoleGate({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const { pathname } = useLocation();
  if (user === null) return null;
  return canAccessPath(user.role, pathname) === false ? <NoAccessPage /> : children;
}
