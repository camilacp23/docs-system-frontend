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
// "Add to-do" (Administrator and Developer) opens AddTodoModal. It is disabled with the reason when the application is
// archived, there is no connection or Jira is not available (the last availability the shell knows, D-100); a screen in
// review can have to-dos (D-92). A creation puts the answer in the tree, draws the new Subtask with a light background,
// says so in a toast with a link to the issue (P-04) and reads the tree again in the background.
// Loading shows a skeleton after 300 ms; a failure of the first read shows the server error state with a retry.
import { ListTodo, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

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
import { useJiraStatus } from '../../layout/jiraStatusContext';
import { countText, formatTimestamp } from '../variables/variableLabels';

import { AddTodoModal } from './AddTodoModal';
import { JiraLink } from './JiraLink';
import { JiraTicketTable } from './JiraTicketTable';
import {
  ADD_TODO_LABEL,
  addTodoBlockReason,
  EMPTY_TEXT,
  EMPTY_TITLE,
  FUTURE_TODO_LABEL,
  JIRA_DOWN_LEAD,
  mergeCreated,
  OPEN_IN_JIRA_LABEL,
  pendingCount,
  safeJiraUrl,
  REFRESH_ARCHIVED_REASON,
  REFRESH_LABEL,
  STALE_LABEL,
} from './jiraTree';
import type { JiraCreated, JiraTree } from './jiraTypes';
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
  const addReasonId = useId();
  const { status: jiraStatus } = useJiraStatus();
  const [adding, setAdding] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
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
  const addReason = addTodoBlockReason(writeReason, jiraStatus === 'unavailable');
  const onCreated = (created: JiraCreated) => {
    jira.apply(mergeCreated(tree, created));
    setHighlightId(created.subtask.id);
    setAdding(false);
    const href = safeJiraUrl(created.subtask.url);
    toast.show({
      message: `${created.subtask.jiraIssueKey} created.`,
      action: href === null ? undefined : { label: OPEN_IN_JIRA_LABEL, href, external: true },
    });
    // The answer is the tree for now; the read brings the state Jira reported after the creation.
    jira.reload();
  };
  const addButton = (
    <>
      <Button
        variant="primary"
        size={epic === null ? 'md' : 'sm'}
        disabled={addReason !== null}
        title={addReason ?? undefined}
        aria-describedby={addReason === null ? undefined : addReasonId}
        iconLeft={<Plus aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />}
        onClick={() => {
          setAdding(true);
        }}
      >
        {ADD_TODO_LABEL}
      </Button>
      {addReason !== null && (
        <span id={addReasonId} className="sr-only">
          {addReason}
        </span>
      )}
    </>
  );

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
              {epic !== null && addButton}
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
            action={canWrite ? addButton : undefined}
          />
        ) : (
          <>
            <JiraTicketTable tree={tree} highlightId={highlightId} />
            <p className="border-t border-divider px-5 py-3 text-small text-ink-500">
              {countText(pending ?? 0, 'pending to-do')}
              {tree.sync.lastSyncedAt !== null &&
                ` · last synced ${formatTimestamp(tree.sync.lastSyncedAt)}`}
            </p>
          </>
        )}
      </SectionCard>
      {adding && (
        <AddTodoModal
          screen={screen}
          tree={tree}
          onClose={() => {
            setAdding(false);
          }}
          onCreated={onCreated}
          onReloadTree={jira.reload}
        />
      )}
    </div>
  );
}
