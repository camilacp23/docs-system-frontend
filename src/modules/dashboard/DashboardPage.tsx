// DashboardPage: the route /dashboard (FR-19): the indicators of the application selected in the shell.
// No props. It reads the application, the user and the two reads of the dashboard (useDashboardData) and hands them to
// DashboardView. Changing the application in the sidebar reads both again (their keys carry the application) and an
// answer of the previous application never shows. Refresh reads both again. An archived application is read like any
// other. If the API says the application does not exist (404) the page shows S-41a and its button reads the list of
// applications again, so the shell picks another one.
import { useMemo } from 'react';

import { ErrorState } from '../../components/ui';
import { useApplication } from '../../application/useApplication';
import { useCurrentUser } from '../../session/useCurrentUser';
import { browserTimeZone } from '../audit/auditDates';

import { DashboardView } from './DashboardView';
import { useDashboardData } from './useDashboardData';

export function DashboardPage() {
  const user = useCurrentUser();
  const { currentApplication, currentApplicationId, reload: reloadApplications } = useApplication();
  const { indicators, top, reload } = useDashboardData(currentApplicationId);
  const timeZone = useMemo(() => browserTimeZone(), []);

  if (user === null || currentApplication === null) return null;

  if (indicators.error?.code === 'NOT_FOUND') {
    return (
      <ErrorState
        variant="not-found"
        element="application"
        listLabel="Dashboard"
        className="flex-1"
        onAction={reloadApplications}
      />
    );
  }

  return (
    <DashboardView
      name={user.name}
      hour={new Date().getHours()}
      applicationName={currentApplication.name}
      indicators={indicators}
      top={top}
      refreshing={indicators.status === 'loading' || top.status === 'loading'}
      onRefresh={reload}
      timeZone={timeZone}
      canCreateScreen={user.role !== 'READER' && currentApplication.status !== 'ARCHIVED'}
    />
  );
}
