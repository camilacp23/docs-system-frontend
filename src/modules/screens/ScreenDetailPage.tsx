// ScreenDetailPage: /screens/:id (S-19, S-19r), read only. Header with the name (IBM Plex Mono), the status tag,
// "Reserved" for App (OnStart), the author and the last update, and the link to the Miro diagram (another tab).
// Four tabs: Template, Components & navigation, Variables & collections and Future to do (the Jira to-dos, with the
// pending count as a badge). The tab is part of the URL (`?tab=components`, `?tab=links`, `?tab=todo`; Template is the
// default and leaves no parameter), so a tab can be linked and the back button returns to the previous one. Comments is
// not drawn yet. The pending to-dos shown in the badge and in the side card are the detail's `pendingSubtasks` until the
// Future to do tab has read the tree; from then on they are the tree's count. (The ETag of the detail follows `updatedAt`,
// which a Jira change does not move, so a read that revalidates could bring a count older than the tree.)
// The workflow actions of the status and the role (screenWorkflow, Table 61, S-25b) are in the header: buttons next to
// Edit and the less frequent ones in the "…" menu. A change goes through PUT /screens/{id}/status with the ETag of the
// detail; the answer and its new ETag replace the copy (no second read) and a toast says what happened. A 412 shows the
// S-44 banner with Reload, INVALID_TRANSITION shows its text and reads the screen again, and TEMPLATE_INCOMPLETE opens
// the edit page (`?tab=template&submit=1`), which says which template fields are missing (S-25a). The actions are disabled with the
// reason when the application is archived or there is no connection (useWriteBlock); a Reader sees none.
// Approve and Return (the Administrator, in review) open ReviewModal (S-37c, S-37b); the answer replaces the copy like
// any other change, and NOT_IN_REVIEW shows its text and reads the screen again.
// Edit (Administrator and Developer) opens /screens/:id/edit; it is disabled with the reason for a screen in review, an
// archived application or no connection (editBlockReason). Delete opens the confirmation with the impact; it is
// disabled with the reason for App (OnStart) and for the same cases (deleteBlockReason); after deleting, the page goes
// back to the list.
// A screen of another application than the selected one selects that application and says so (D-78); switching
// application from the shell while the page is open goes back to the list.
// The breadcrumb reads "Screens / <name>". Loading shows a skeleton after 300 ms; unknown id: "This screen doesn't
// exist" (S-41a); other failures: the server error state with a retry. The read revalidates with the ETag (D-72).
import { Monitor, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { getErrorMessage } from '../../api/messages';
import { useFollowElementApplication } from '../../application/useFollowElementApplication';
import {
  Banner,
  Button,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHeader,
  Skeleton,
  StatusTag,
  Tabs,
  Tag,
  tabPanelProps,
  useDelayedLoading,
  useToast,
} from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';
import { useBreadcrumbLabel } from '../../layout/breadcrumbContext';
import { useCurrentUser } from '../../session/useCurrentUser';
import { parseId } from '../variables/parseId';
import { formatTimestamp } from '../variables/variableLabels';

import { DeleteScreenModal } from './DeleteScreenModal';
import { JiraTicketsTab } from './JiraTicketsTab';
import { MiroLink } from './MiroLink';
import { ScreenComponentsTab } from './ScreenComponentsTab';
import { ScreenLinksTab } from './ScreenLinksTab';
import { ScreenTemplateTab } from './ScreenTemplateTab';
import { ReviewModal } from './ReviewModal';
import { WorkflowButtons, WorkflowMenu } from './ScreenWorkflowControls';
import { deleteBlockReason, editBlockReason } from './screenActionBlock';
import { FUTURE_TODO_LABEL } from './jiraTree';
import { RESERVED_LABEL, toTagStatus } from './screenLabels';
import { workflowActions, workflowToast, type WorkflowAction } from './screenWorkflow';
import { useScreen } from './useScreen';
import { useScreenStatusChange } from './useScreenStatusChange';

const LIST_PATH = '/screens';
const TAB_PREFIX = 'screen';

type TabKey = 'template' | 'components' | 'links' | 'todo';
const TAB_KEYS: readonly TabKey[] = ['template', 'components', 'links', 'todo'];

export function ScreenDetailPage() {
  const { id: rawId } = useParams();
  const id = parseId(rawId);
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const user = useCurrentUser();
  const canWrite = user !== null && user.role !== 'READER';
  const { reason: writeReason } = useWriteBlock();
  const [deleting, setDeleting] = useState(false);
  // The pending to-dos the Future to do tab computed from the tree (null until the tab has been opened).
  const [livePending, setLivePending] = useState<number | null>(null);
  const onPendingChange = useCallback((count: number) => {
    setLivePending(count);
  }, []);

  const tab: TabKey = TAB_KEYS.find((key) => key === search.get('tab')) ?? 'template';
  const screen = useScreen(id);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const workflowReasonId = useId();
  const toast = useToast();
  const [reviewing, setReviewing] = useState<'APPROVE' | 'RETURN' | null>(null);
  // After a decision the button that opened the modal is gone: the focus goes to the title once the modal has closed.
  const [focusTitle, setFocusTitle] = useState(0);
  useEffect(() => {
    if (focusTitle > 0) titleRef.current?.focus();
  }, [focusTitle]);

  const loaded = screen.status === 'ready' ? screen.data : null;
  useFollowElementApplication(loaded?.applicationId ?? null, LIST_PATH);
  useBreadcrumbLabel(loaded === null ? null : loaded.name);
  const { showSkeleton } = useDelayedLoading(screen.loading && id !== null);
  const change = useScreenStatusChange({
    screen: { id: id ?? 0, name: loaded?.name ?? '' },
    etag: screen.etag,
    apply: screen.apply,
    reload: screen.reload,
    onTemplateIncomplete: () => {
      // S-25a: the edit page shows what is missing, computed from the screen's own data (`submit=1` is only the signal).
      void navigate(`/screens/${id ?? 0}/edit?tab=template&submit=1`);
    },
    onDone: () => {
      // The button that was pressed may be gone (Submit after submitting): the focus goes to the title.
      titleRef.current?.focus();
    },
  });

  const notFound = id === null || screen.error?.code === 'NOT_FOUND';
  if (notFound) {
    return (
      <ErrorState
        variant="not-found"
        element="screen"
        listLabel="Screens"
        className="flex-1"
        onAction={() => {
          void navigate(LIST_PATH);
        }}
      />
    );
  }
  if (screen.status === 'error') {
    return (
      <ErrorState
        variant="server-error"
        requestId={screen.error?.requestId ?? undefined}
        className="flex-1"
        onAction={screen.reload}
      />
    );
  }
  if (loaded === null) {
    return showSkeleton ? (
      <div role="status" aria-label="Loading" className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    ) : null;
  }

  const pendingSubtasks = livePending ?? loaded.pendingSubtasks;
  const blockReason = deleteBlockReason(loaded, writeReason);
  const editReason = editBlockReason(loaded, writeReason);
  const actions = workflowActions(loaded.documentationStatus, user?.role);
  const controls = {
    actions,
    reason: writeReason,
    reasonId: workflowReasonId,
    running: change.running,
    onRun: (action: WorkflowAction) => {
      if (action.kind === 'status') void change.run(action);
      else {
        change.clearProblem();
        setReviewing(action.decision);
      }
    },
  };

  return (
    <>
      <PageHeader
        icon={<Monitor size={20} strokeWidth={ICON_STROKE_WIDTH} />}
        title={<span className="font-mono">{loaded.name}</span>}
        titleRef={titleRef}
        meta={
          <>
            <StatusTag status={toTagStatus(loaded.documentationStatus)} />
            {loaded.isAppContext && <Tag>{RESERVED_LABEL}</Tag>}
            <span className="text-label text-ink-500">
              Author {loaded.author.name} · Updated {formatTimestamp(loaded.updatedAt)}
            </span>
          </>
        }
        actions={
          <>
            <MiroLink href={loaded.miroLink}>Open in Miro</MiroLink>
            {canWrite && (
              <>
                <WorkflowButtons {...controls} beforeEdit />
                <Button
                  variant="primary"
                  disabled={editReason !== null}
                  title={editReason ?? undefined}
                  aria-describedby={editReason === null ? undefined : 'screen-edit-reason'}
                  iconLeft={<Pencil aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
                  onClick={() => {
                    void navigate(`/screens/${loaded.id}/edit`);
                  }}
                >
                  Edit
                </Button>
                {editReason !== null && (
                  <span id="screen-edit-reason" className="sr-only">
                    {editReason}
                  </span>
                )}
                <WorkflowButtons {...controls} beforeEdit={false} />
                <WorkflowMenu {...controls} />
                {writeReason !== null && actions.length > 0 && (
                  <span id={workflowReasonId} className="sr-only">
                    {writeReason}
                  </span>
                )}
                <Button
                  variant="danger"
                  disabled={blockReason !== null}
                  title={blockReason ?? undefined}
                  aria-describedby={blockReason === null ? undefined : 'screen-delete-reason'}
                  iconLeft={<Trash2 aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
                  onClick={() => {
                    setDeleting(true);
                  }}
                >
                  Delete
                </Button>
                {blockReason !== null && (
                  <span id="screen-delete-reason" className="sr-only">
                    {blockReason}
                  </span>
                )}
              </>
            )}
          </>
        }
      />

      {change.problem !== null && (
        <Banner
          tone={change.problem.kind === 'conflict' ? 'warning' : 'danger'}
          onDismiss={change.problem.kind === 'conflict' ? undefined : change.clearProblem}
          actions={
            change.problem.kind === 'conflict' ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  change.clearProblem();
                  screen.reload();
                }}
              >
                Reload
              </Button>
            ) : undefined
          }
        >
          {change.problem.text}
        </Banner>
      )}

      <Tabs<TabKey>
        label="Screen sections"
        idPrefix={TAB_PREFIX}
        value={tab}
        onChange={(key) => {
          setSearch((current) => {
            const next = new URLSearchParams(current);
            if (key === 'template') next.delete('tab');
            else next.set('tab', key);
            return next;
          });
        }}
        tabs={[
          { key: 'template', label: 'Template' },
          { key: 'components', label: 'Components & navigation' },
          { key: 'links', label: 'Variables & collections' },
          {
            key: 'todo',
            label: FUTURE_TODO_LABEL,
            count: pendingSubtasks > 0 ? pendingSubtasks : undefined,
          },
        ]}
      />

      <div {...tabPanelProps(TAB_PREFIX, tab)}>
        {tab === 'template' && (
          <ScreenTemplateTab screen={loaded} pendingSubtasks={pendingSubtasks} />
        )}
        {tab === 'components' && <ScreenComponentsTab screen={loaded} />}
        {tab === 'links' && <ScreenLinksTab screen={loaded} />}
        {tab === 'todo' && (
          <JiraTicketsTab screen={loaded} canWrite={canWrite} onPendingChange={onPendingChange} />
        )}
      </div>

      {reviewing !== null && (
        <ReviewModal
          screen={loaded}
          decision={reviewing}
          onClose={() => {
            setReviewing(null);
          }}
          onReviewed={(reviewed, etag) => {
            screen.apply(reviewed, etag);
            toast.show({
              message: workflowToast(reviewing === 'APPROVE' ? 'approve' : 'return', loaded.name),
            });
            setReviewing(null);
            setFocusTitle((count) => count + 1);
          }}
          onRefused={(error) => {
            setReviewing(null);
            change.showProblem(getErrorMessage(error, { element: 'screen' }) ?? '');
            screen.reload();
          }}
        />
      )}

      {deleting && (
        <DeleteScreenModal
          screen={loaded}
          onClose={() => {
            setDeleting(false);
          }}
          onDeleted={() => {
            void navigate(LIST_PATH);
          }}
        />
      )}
    </>
  );
}
