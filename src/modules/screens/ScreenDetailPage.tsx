// ScreenDetailPage: /screens/:id (S-19, S-19r), read only. Header with the name (IBM Plex Mono), the status tag,
// "Reserved" for App (OnStart), the author and the last update, and the link to the Miro diagram (another tab).
// Three tabs: Template, Components & navigation and Variables & collections. The tab is part of the URL
// (`?tab=components`, `?tab=links`; Template is the default and leaves no parameter), so a tab can be linked and
// the back button returns to the previous one. Future to do and Comments are not drawn yet.
// The workflow actions of the status and the role (screenWorkflow, Table 61, S-25b) are in the header: buttons next to
// Edit and the less frequent ones in the "…" menu. A change goes through PUT /screens/{id}/status with the ETag of the
// detail; the answer and its new ETag replace the copy (no second read) and a toast says what happened. A 412 shows the
// S-44 banner with Reload, INVALID_TRANSITION shows its text and reads the screen again. The actions are disabled with the
// reason when the application is archived or there is no connection (useWriteBlock); a Reader sees none.
// Edit (Administrator and Developer) opens /screens/:id/edit; it is disabled with the reason for a screen in review, an
// archived application or no connection (editBlockReason). Delete opens the confirmation with the impact; it is
// disabled with the reason for App (OnStart) and for the same cases (deleteBlockReason); after deleting, the page goes
// back to the list.
// A screen of another application than the selected one selects that application and says so (D-78); switching
// application from the shell while the page is open goes back to the list.
// The breadcrumb reads "Screens / <name>". Loading shows a skeleton after 300 ms; unknown id: "This screen doesn't
// exist" (S-41a); other failures: the server error state with a retry. The read revalidates with the ETag (D-72).
import { Monitor, Pencil, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

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
} from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';
import { useBreadcrumbLabel } from '../../layout/breadcrumbContext';
import { useCurrentUser } from '../../session/useCurrentUser';
import { parseId } from '../variables/parseId';
import { formatTimestamp } from '../variables/variableLabels';

import { DeleteScreenModal } from './DeleteScreenModal';
import { MiroLink } from './MiroLink';
import { ScreenComponentsTab } from './ScreenComponentsTab';
import { ScreenLinksTab } from './ScreenLinksTab';
import { ScreenTemplateTab } from './ScreenTemplateTab';
import { WorkflowButtons, WorkflowMenu } from './ScreenWorkflowControls';
import { deleteBlockReason, editBlockReason } from './screenActionBlock';
import { RESERVED_LABEL, toTagStatus } from './screenLabels';
import { workflowActions, type WorkflowAction } from './screenWorkflow';
import { useScreen } from './useScreen';
import { useScreenStatusChange } from './useScreenStatusChange';

const LIST_PATH = '/screens';
const TAB_PREFIX = 'screen';

type TabKey = 'template' | 'components' | 'links';
const TAB_KEYS: readonly TabKey[] = ['template', 'components', 'links'];

export function ScreenDetailPage() {
  const { id: rawId } = useParams();
  const id = parseId(rawId);
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const user = useCurrentUser();
  const canWrite = user !== null && user.role !== 'READER';
  const { reason: writeReason } = useWriteBlock();
  const [deleting, setDeleting] = useState(false);

  const tab: TabKey = TAB_KEYS.find((key) => key === search.get('tab')) ?? 'template';
  const screen = useScreen(id);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const workflowReasonId = useId();

  const loaded = screen.status === 'ready' ? screen.data : null;
  useFollowElementApplication(loaded?.applicationId ?? null, LIST_PATH);
  useBreadcrumbLabel(loaded === null ? null : loaded.name);
  const { showSkeleton } = useDelayedLoading(screen.loading && id !== null);
  const change = useScreenStatusChange({
    screen: { id: id ?? 0, name: loaded?.name ?? '' },
    etag: screen.etag,
    apply: screen.apply,
    reload: screen.reload,
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

  const blockReason = deleteBlockReason(loaded, writeReason);
  const editReason = editBlockReason(loaded, writeReason);
  // Approve and Return (a decision of the review, with its own modal) are not drawn yet.
  const actions: WorkflowAction[] = workflowActions(loaded.documentationStatus, user?.role).filter(
    (action) => action.kind === 'status',
  );
  const controls = {
    actions,
    reason: writeReason,
    reasonId: workflowReasonId,
    running: change.running,
    onRun: (action: WorkflowAction) => {
      if (action.kind === 'status') void change.run(action);
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
        ]}
      />

      <div {...tabPanelProps(TAB_PREFIX, tab)}>
        {tab === 'template' && <ScreenTemplateTab screen={loaded} />}
        {tab === 'components' && <ScreenComponentsTab screen={loaded} />}
        {tab === 'links' && <ScreenLinksTab screen={loaded} />}
      </div>

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
