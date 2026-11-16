// DashboardPage: the route /dashboard (FR-19): the indicators of the application selected in the shell.
// No props. It reads the application, the user and the two reads of the dashboard (useDashboardData) and hands them to
// DashboardView. Changing the application in the sidebar reads both again (their keys carry the application) and an
// answer of the previous application never shows. Refresh reads both again. An archived application is read like any
// other. If the API says the application does not exist (404) the page shows S-41a and its button reads the list of
// applications again, so the shell picks another one. "Generate report" (Administrator and Developer, an archived
// application too: reports can be generated there, D-47) opens the dialog of S-34 and, after the 202, goes to /reports (flow 5).
import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router';

import { ErrorState, useToast } from '../../components/ui';
import { useApplication } from '../../application/useApplication';
import { useOfflineBlock } from '../../hooks/useOfflineBlock';
import { useJiraStatus } from '../../layout/jiraStatusContext';
import { useCurrentUser } from '../../session/useCurrentUser';
import { browserTimeZone } from '../audit/auditDates';
import type { GenerateReportModalProps } from '../reports/GenerateReportModal';

import { DashboardView } from './DashboardView';
import { DIALOG_LOAD_FAILED } from './dashboardTexts';
import { useDashboardData } from './useDashboardData';

export function DashboardPage() {
  const user = useCurrentUser();
  const { currentApplication, currentApplicationId, reload: reloadApplications } = useApplication();
  const { indicators, top, reload } = useDashboardData(currentApplicationId);
  const timeZone = useMemo(() => browserTimeZone(), []);
  const navigate = useNavigate();
  const offline = useOfflineBlock();
  const toast = useToast();
  // The dialog is code of the reports page: it is loaded when "Generate report" is pressed, so the main bundle does not carry it.
  const [Dialog, setDialog] = useState<ComponentType<GenerateReportModalProps> | null>(null);
  const openDialog = () => {
    import('../reports/GenerateReportModal').then(
      (module) => {
        setDialog(() => module.GenerateReportModal);
      },
      () => {
        toast.show({ tone: 'warning', message: DIALOG_LOAD_FAILED });
      },
    );
  };

  // The indicators say whether Jira answered (from the state of its client, never by calling it): the pill of the top bar
  // keeps the last state the session learned (D-100), whichever page learned it.
  const { report } = useJiraStatus();
  const jiraAvailable = indicators.data?.indicators.jira.jiraAvailable;
  const readAt = indicators.data?.readAt;
  useEffect(() => {
    if (jiraAvailable !== undefined) report(jiraAvailable);
  }, [jiraAvailable, readAt, report]);

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

  const canGenerate = user.role !== 'READER';

  return (
    <>
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
        withActivity={user.role !== 'READER'}
        onGenerateReport={canGenerate ? openDialog : undefined}
        generateDisabledReason={offline.reason}
      />
      {Dialog !== null && (
        <Dialog
          applicationId={currentApplication.id}
          applicationName={currentApplication.name}
          onClose={() => {
            setDialog(null);
          }}
          onCreated={() => {
            // Flow 5: the report is listed as PENDING on the reports page, where it is followed.
            void navigate('/reports');
          }}
        />
      )}
    </>
  );
}
