// RootLayout: the root route element (the page and the session notices S-43a / S-43b) and RootError, the
// fallback when an error escapes every page (S-41c without the shell). No props.
import { Outlet } from 'react-router';

import { ServerErrorPage } from '../../modules/errors/ErrorPages';
import { SessionNotices } from '../SessionNotices';

export function RootLayout() {
  return (
    <>
      <Outlet />
      <SessionNotices />
    </>
  );
}

export function RootError() {
  return (
    <main className="flex min-h-screen flex-col bg-canvas">
      <ServerErrorPage />
    </main>
  );
}
