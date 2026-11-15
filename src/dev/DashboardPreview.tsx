// DashboardPreview: development page /dev/dashboard. It renders the dashboard (DashboardView) over the figures of the frame
// S-31 inside the static shell of the frames, with no session and no API, so the design can be looked at and photographed
// in every state.
// Query: role=admin (default, S-31) | developer | reader (S-31r); jira=down (Jira unavailable, S-31j: the pill and the
// card follow it); data=empty (an application with only App (OnStart)); hour=<0-23> (the greeting, default 9 so the
// photographs say "Good morning" like the frames).
// Like /dev/ui and /dev/map it only exists in development (see devRoutes.ts): in the production build the route is folded away.
import { useSearchParams } from 'react-router';

import type {
  DashboardSource,
  IndicatorsRead,
  TopRead,
} from '../modules/dashboard/useDashboardData';
import { DashboardView } from '../modules/dashboard/DashboardView';
import type { Indicators } from '../modules/dashboard/dashboardModel';
import { browserTimeZone } from '../modules/audit/auditDates';

import { MockShell, type MockRole } from './MockShell';

type ActivitySample = NonNullable<Indicators['recentActivity']>;

const ACTIVITY: ActivitySample = [
  {
    actor: { id: 2, name: 'Sample Developer A' },
    action: 'UPDATE',
    eventName: null,
    entityType: 'screen',
    entityId: '12',
    entityLabel: 'Detalle',
    createdAt: '2026-11-14T16:21:00.000Z',
  },
  {
    actor: { id: 1, name: 'Camila Castillo' },
    action: 'EVENT',
    eventName: 'DOCUMENTATION_APPROVED',
    entityType: 'screen',
    entityId: '11',
    entityLabel: 'Inicio',
    createdAt: '2026-11-14T16:05:00.000Z',
  },
  {
    actor: { id: 9, name: 'Integración Jira' },
    action: 'UPDATE',
    eventName: null,
    entityType: 'jira_ticket',
    entityId: '104',
    entityLabel: 'TECHEA-104',
    createdAt: '2026-11-14T15:52:00.000Z',
  },
  {
    actor: { id: 3, name: 'Sample Developer B' },
    action: 'CREATE',
    eventName: null,
    entityType: 'variable',
    entityId: '40',
    entityLabel: 'locOrden',
    createdAt: '2026-11-14T15:14:00.000Z',
  },
];

function sampleIndicators(role: MockRole, jiraDown: boolean, empty: boolean): Indicators {
  const base: Indicators = empty
    ? {
        documentation: {
          totalScreens: 1,
          byStatus: { UNDOCUMENTED: 1, DRAFT: 0, IN_PROGRESS: 0, IN_REVIEW: 0, APPROVED: 0 },
          approvedPercent: 0,
        },
        variables: { total: 0, untraced: 0 },
        collections: { total: 0, undocumented: 0 },
        jira: { pendingSubtasks: 0, jiraAvailable: !jiraDown, lastSyncedAt: null },
      }
    : {
        documentation: {
          totalScreens: 24,
          byStatus: { UNDOCUMENTED: 2, DRAFT: 3, IN_PROGRESS: 6, IN_REVIEW: 3, APPROVED: 10 },
          approvedPercent: 41.7,
        },
        variables: { total: 134, untraced: 9 },
        collections: { total: 4, undocumented: 1 },
        jira: {
          pendingSubtasks: 6,
          jiraAvailable: !jiraDown,
          lastSyncedAt: '2026-10-05T14:40:00.000Z',
        },
      };
  return role === 'READER' ? base : { ...base, recentActivity: empty ? [] : ACTIVITY };
}

const USERS: Record<MockRole, { name: string; roleLabel: string }> = {
  ADMINISTRATOR: { name: 'Camila Castillo', roleLabel: 'Administrator' },
  DEVELOPER: { name: 'Sample Developer A', roleLabel: 'Developer' },
  READER: { name: 'Sample Reader', roleLabel: 'Reader' },
};

const NO_OP = () => undefined;

export function DashboardPreview() {
  const [search] = useSearchParams();
  const roleParam = search.get('role');
  const role: MockRole =
    roleParam === 'developer' ? 'DEVELOPER' : roleParam === 'reader' ? 'READER' : 'ADMINISTRATOR';
  const jiraDown = search.get('jira') === 'down';
  const empty = search.get('data') === 'empty';
  const hour = Number(search.get('hour') ?? 9);
  const user = USERS[role];

  const indicators: DashboardSource<IndicatorsRead> = {
    status: 'ready',
    data: {
      applicationId: 1,
      indicators: sampleIndicators(role, jiraDown, empty),
      readAt: '2026-11-14T16:24:00.000Z',
    },
    error: null,
    reload: NO_OP,
  };
  const top: DashboardSource<TopRead> = {
    status: 'ready',
    data: {
      applicationId: 1,
      screens: empty
        ? []
        : [
            { id: 12, name: 'Detalle', pending: 3 },
            { id: 10, name: 'App (OnStart)', pending: 2 },
            { id: 11, name: 'Inicio', pending: 1 },
          ],
    },
    error: null,
    reload: NO_OP,
  };

  return (
    <MockShell
      activeLabel="Dashboard"
      pageName="Dashboard"
      role={role}
      user={user}
      jira={jiraDown ? 'unavailable' : 'available'}
    >
      <DashboardView
        name={user.name}
        hour={Number.isInteger(hour) ? hour : 9}
        applicationName="SAR"
        indicators={indicators}
        top={top}
        refreshing={false}
        onRefresh={NO_OP}
        timeZone={browserTimeZone()}
        canCreateScreen={role !== 'READER'}
        withActivity={role !== 'READER'}
      />
    </MockShell>
  );
}
