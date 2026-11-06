// ScreenDetailPage: /screens/:id (S-19, S-19r), read only. Header with the name (IBM Plex Mono), the status tag,
// "Reserved" for App (OnStart), the author and the last update, and the link to the Miro diagram (another tab).
// Three tabs: Template, Components & navigation and Variables & collections. The tab is part of the URL
// (`?tab=components`, `?tab=links`; Template is the default and leaves no parameter), so a tab can be linked and
// the back button returns to the previous one. Future to do and Comments are not drawn yet; editing and the workflow
// actions are not on this page yet either.
// Delete (Administrator and Developer) opens the confirmation with the impact; it is disabled with the reason for
// App (OnStart), a screen in review, an archived application or no connection (deleteBlockReason); after deleting,
// the page goes back to the list.
// A screen of another application than the selected one selects that application and says so (D-78); switching
// application from the shell while the page is open goes back to the list.
// The breadcrumb reads "Screens / <name>". Loading shows a skeleton after 300 ms; unknown id: "This screen doesn't
// exist" (S-41a); other failures: the server error state with a retry. The read revalidates with the ETag (D-72).
import { Monitor, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { useFollowElementApplication } from '../../application/useFollowElementApplication';
import {
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
import { deleteBlockReason } from './screenDeleteBlock';
import { RESERVED_LABEL, toTagStatus } from './screenLabels';
import { useScreen } from './useScreen';

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

  const loaded = screen.status === 'ready' ? screen.data : null;
  useFollowElementApplication(loaded?.applicationId ?? null, LIST_PATH);
  useBreadcrumbLabel(loaded === null ? null : loaded.name);
  const { showSkeleton } = useDelayedLoading(screen.loading && id !== null);

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

  return (
    <>
      <PageHeader
        icon={<Monitor size={20} strokeWidth={ICON_STROKE_WIDTH} />}
        title={<span className="font-mono">{loaded.name}</span>}
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
