// JiraTicketsTab: the Future to do tab of the screen detail (S-23, S-23b): the screen's Jira Epic, its Stories and their
// Subtasks as a table (JiraTicketTable), with the date of the last synchronization and the pending to-dos.
// Props: screen, canWrite (Administrator and Developer: they have "Refresh from Jira", SDD Table 56; a Reader only
// queries), onPendingChange(count) (the Subtasks not done of the tree, so the detail shows the same number elsewhere).
// Opening the tab reads the local copy (fast; the webhook keeps it up to date). "Refresh from Jira" is manual and asks the
// server to bring the copy up to date; it is disabled with the reason when the application is archived (the server
// never calls Jira for it) or there is no connection.
// Degraded state (S-23b, NFR-14): when the last refresh could not complete (`sync.stale`) or Jira is not available
// (`sync.jiraAvailable` false) a warning banner says so with the date of the saved copy and the Epic gets the "Stale" tag.
// It is never a global alarm: the rest of the screen keeps working. Without an Epic the tab is an empty state.
// Loading shows a skeleton after 300 ms; a failure of the first read shows the server error state with a retry.
import { ListTodo, RefreshCw } from 'lucide-react';
import { useEffect, useId } from 'react';

import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  ICON_STROKE_WIDTH,
  SectionCard,
  Skeleton,
  Tag,
  useDelayedLoading,
  useToast,
} from '../../components/ui';
import { ARCHIVED_WRITE_REASON, useWriteBlock } from '../../hooks/useWriteBlock';
import { countText, formatTimestamp } from '../variables/variableLabels';

import { JiraLink } from './JiraLink';
import { JiraTicketTable } from './JiraTicketTable';
import {
  EMPTY_TEXT,
  EMPTY_TITLE,
  FUTURE_TODO_LABEL,
  JIRA_DOWN_LEAD,
  pendingCount,
  REFRESH_ARCHIVED_REASON,
  REFRESH_LABEL,
  STALE_LABEL,
} from './jiraTree';
import type { JiraTree } from './jiraTypes';
import type { Screen } from './screenTypes';
import { useJiraTickets } from './useJiraTickets';

export const REFRESHED_TEXT = 'Refreshed from Jira.';

interface JiraTicketsTabProps {
  screen: Screen;
  canWrite: boolean;
  onPendingChange: (count: number) => void;
}

function savedCopyText(tree: JiraTree): string {
  const at = tree.sync.lastSyncedAt;
  return at === null
    ? "You're seeing the saved copy; statuses may be out of date."
    : `You're seeing the copy saved on ${formatTimestamp(at)}; statuses may be out of date.`;
}

export function JiraTicketsTab({ screen, canWrite, onPendingChange }: JiraTicketsTabProps) {
  const jira = useJiraTickets(screen.id);
  const { reason: writeReason } = useWriteBlock();
  const toast = useToast();
  const refreshReasonId = useId();
  const { showSkeleton } = useDelayedLoading(jira.loading && jira.tree === null);
  const { tree } = jira;

  const pending = tree === null ? null : pendingCount(tree);
  useEffect(() => {
    if (pending !== null) onPendingChange(pending);
  }, [pending, onPendingChange]);

  if (tree === null) {
    if (jira.status === 'error') {
      return (
        <ErrorState
          variant="server-error"
          requestId={jira.error?.requestId ?? undefined}
          onAction={jira.reload}
        />
      );
    }
    return showSkeleton ? (
      <div role="status" aria-label="Loading" className="flex flex-col gap-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    ) : null;
  }

  const degraded = tree.sync.stale || !tree.sync.jiraAvailable;
  const refreshReason =
    writeReason === ARCHIVED_WRITE_REASON ? REFRESH_ARCHIVED_REASON : writeReason;
  const onRefresh = async () => {
    const refreshed = await jira.refresh();
    if (refreshed !== null && !refreshed.sync.stale) toast.show({ message: REFRESHED_TEXT });
  };

  const epic = tree.epic;
  return (
    <div className="flex flex-col gap-4">
      {degraded && (
        <Banner tone="warning" lead={JIRA_DOWN_LEAD}>
          {savedCopyText(tree)}
        </Banner>
      )}
      {jira.refreshError !== null && (
        <Banner tone="danger" onDismiss={jira.clearRefreshError}>
          {jira.refreshError}
        </Banner>
      )}
      <SectionCard
        title={FUTURE_TODO_LABEL}
        icon={<ListTodo size={16} strokeWidth={ICON_STROKE_WIDTH} />}
        description={
          epic === null ? (
            'Jira Subtasks to do on this screen'
          ) : (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                Epic{' '}
                <span className="font-mono font-semibold text-ink-900">{epic.jiraIssueKey}</span> ·{' '}
                {epic.summary}
              </span>
              <JiraLink ticket={epic} />
              {degraded && <Tag tone="warning">{STALE_LABEL}</Tag>}
            </span>
          )
        }
        actions={
          canWrite ? (
            <>
              <Button
                size="sm"
                loading={jira.refreshing}
                disabled={refreshReason !== null}
                title={refreshReason ?? undefined}
                aria-describedby={refreshReason === null ? undefined : refreshReasonId}
                iconLeft={
                  <RefreshCw aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
                }
                onClick={() => void onRefresh()}
              >
                {REFRESH_LABEL}
              </Button>
              {refreshReason !== null && (
                <span id={refreshReasonId} className="sr-only">
                  {refreshReason}
                </span>
              )}
            </>
          ) : undefined
        }
        flush
      >
        {epic === null ? (
          <EmptyState
            icon={<ListTodo strokeWidth={ICON_STROKE_WIDTH} />}
            title={EMPTY_TITLE}
            description={EMPTY_TEXT}
          />
        ) : (
          <>
            <JiraTicketTable tree={tree} highlightId={null} />
            <p className="border-t border-divider px-5 py-3 text-small text-ink-500">
              {countText(pending ?? 0, 'pending to-do')}
              {tree.sync.lastSyncedAt !== null &&
                ` · last synced ${formatTimestamp(tree.sync.lastSyncedAt)}`}
            </p>
          </>
        )}
      </SectionCard>
    </div>
  );
}
