// AppShell: the layout of every signed-in page (S-31): sidebar 268 px | top bar 68 px, status strips under the
// top bar (offline S-46, archived application S-09b) and the page in <Outlet/>; long pages scroll inside the
// fixed shell. It also covers the states of the application list: loading failure (S-41c style) and no
// application registered (neutral empty state), except on /admin/applications where one is registered.
// No props; the user comes from the session (the last user while the "session ended" dialog is open).
import { Archive, CircleAlert, Database } from 'lucide-react';
import { Outlet, useLocation } from 'react-router';

import { useApplication } from '../application/useApplication';
import { EmptyState, ErrorState, ICON_STROKE_WIDTH } from '../components/ui';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useCurrentUser } from '../session/useCurrentUser';

import { Sidebar } from './Sidebar';
import { StatusStrip } from './StatusStrip';
import { TopBar } from './TopBar';
import { UnarchiveButton } from './UnarchiveButton';

export const NO_APPLICATIONS_TITLE = 'No applications yet';
export const NO_APPLICATIONS_TEXT =
  'An administrator needs to register an application before documentation can start.';
export const OFFLINE_TEXT = "Changes can't be saved until the connection is back.";
export const ARCHIVED_TEXT = 'Its documentation is read-only.';

const REGISTER_APPLICATION_PATH = '/admin/applications';

function ShellContent() {
  const { status, error, applications, reload } = useApplication();
  const { pathname } = useLocation();

  if (status === 'error') {
    return (
      <ErrorState
        variant="server-error"
        requestId={error?.requestId ?? undefined}
        className="flex-1"
        onAction={reload}
      />
    );
  }
  if (status === 'ready' && applications.length === 0 && pathname !== REGISTER_APPLICATION_PATH) {
    return (
      <div className="rounded-card border border-border-subtle bg-surface shadow-card">
        <EmptyState
          icon={<Database strokeWidth={ICON_STROKE_WIDTH} />}
          title={NO_APPLICATIONS_TITLE}
          description={NO_APPLICATIONS_TEXT}
        />
      </div>
    );
  }
  return <Outlet />;
}

export function AppShell() {
  const user = useCurrentUser();
  const online = useOnlineStatus();
  const { currentApplication } = useApplication();

  if (user === null) return null;
  const archived = currentApplication?.status === 'ARCHIVED';
  const iconProps = { size: 18, strokeWidth: ICON_STROKE_WIDTH } as const;

  return (
    <div className="grid h-screen grid-cols-[268px_minmax(0,1fr)] grid-rows-[68px_auto_minmax(0,1fr)] bg-canvas">
      <Sidebar role={user.role} />
      <TopBar user={user} />
      <div className="col-start-2">
        {!online && (
          <StatusStrip icon={<CircleAlert {...iconProps} />} lead="You're offline.">
            {OFFLINE_TEXT}
          </StatusStrip>
        )}
        {archived && (
          <StatusStrip
            icon={<Archive {...iconProps} />}
            lead="This application is archived."
            action={user.role === 'ADMINISTRATOR' ? <UnarchiveButton /> : undefined}
          >
            {ARCHIVED_TEXT}
          </StatusStrip>
        )}
      </div>
      <main className="col-start-2 flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
        <ShellContent />
      </main>
    </div>
  );
}
