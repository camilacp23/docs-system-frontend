// CollectionDetailPage: /collections/:id (S-15a-c). Hero with the name (icon tile of the size of the edit page's), the Delete
// and Edit actions, both not for the Reader, and three tabs: Overview, Fields and Variable
// assignments. The tab is part of the URL (`?tab=fields`, `?tab=assignments`; Overview is the default and leaves no
// parameter), so a tab can be linked and the back button returns to the previous one. The fields tab keeps its page
// and page size in the URL too (`fpage`, `fsize`).
// A collection of another application than the selected one selects that application and says so (D-78); switching
// application from the shell while the page is open goes back to the list.
// The breadcrumb reads "Collections / <name>". Loading shows a skeleton after 300 ms; unknown id: "This collection
// doesn't exist" (S-41a); other failures: the server error state with a retry.
import { Database, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { useApplication } from '../../application/useApplication';
import { useFollowElementApplication } from '../../application/useFollowElementApplication';
import {
  Button,
  ButtonLink,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHero,
  PAGE_SIZES,
  Skeleton,
  Tabs,
  tabPanelProps,
  useDelayedLoading,
} from '../../components/ui';
import { ARCHIVED_WRITE_REASON } from '../../hooks/useWriteBlock';
import { useBreadcrumbLabel } from '../../layout/breadcrumbContext';
import { useCurrentUser } from '../../session/useCurrentUser';
import { parseId } from '../variables/parseId';

import { CollectionAssignmentsTab } from './CollectionAssignmentsTab';
import { CollectionFieldsTab } from './CollectionFieldsTab';
import { CollectionOverview } from './CollectionOverview';
import type { Collection } from './collectionTypes';
import { DeleteCollectionModal } from './DeleteCollectionModal';

const LIST_PATH = '/collections';
const TAB_PREFIX = 'collection';
const DEFAULT_FIELDS_PAGE_SIZE = 20;

type TabKey = 'overview' | 'fields' | 'assignments';
const TAB_KEYS: readonly TabKey[] = ['overview', 'fields', 'assignments'];

function positiveInteger(value: string | null): number | null {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

export function CollectionDetailPage() {
  const { id: rawId } = useParams();
  const id = parseId(rawId);
  const client = useApi();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { currentApplication } = useApplication();
  const canWrite = user !== null && user.role !== 'READER';
  const archived = currentApplication?.status === 'ARCHIVED';
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useSearchParams();

  const tab: TabKey = TAB_KEYS.find((key) => key === search.get('tab')) ?? 'overview';
  const fieldsPage = positiveInteger(search.get('fpage')) ?? 1;
  const requestedSize = positiveInteger(search.get('fsize'));
  const fieldsPageSize =
    requestedSize !== null && PAGE_SIZES.includes(requestedSize)
      ? requestedSize
      : DEFAULT_FIELDS_PAGE_SIZE;

  const patchSearch = (patch: Record<string, string | null>) => {
    setSearch((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      return next;
    });
  };

  const collection = useApiResource<Collection>(
    `collection:${id}`,
    async (signal) => {
      const result = await client.get('/collections/{id}', { path: { id: id ?? 0 }, signal });
      return { body: result.body.data, etag: result.etag };
    },
    id !== null,
  );

  const loaded = collection.status === 'ready' ? collection.data : null;
  useFollowElementApplication(loaded?.applicationId ?? null, LIST_PATH);
  useBreadcrumbLabel(loaded === null ? null : loaded.name);
  const { showSkeleton } = useDelayedLoading(collection.loading && id !== null);

  const notFound = id === null || collection.error?.code === 'NOT_FOUND';
  if (notFound) {
    return (
      <ErrorState
        variant="not-found"
        element="collection"
        listLabel="Collections"
        className="flex-1"
        onAction={() => {
          void navigate(LIST_PATH);
        }}
      />
    );
  }
  if (collection.status === 'error') {
    return (
      <ErrorState
        variant="server-error"
        requestId={collection.error?.requestId ?? undefined}
        className="flex-1"
        onAction={collection.reload}
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

  return (
    <>
      <PageHero
        tone="collection"
        compact
        icon={<Database size={18} strokeWidth={ICON_STROKE_WIDTH} />}
        title={<span className="font-mono">{loaded.name}</span>}
        actions={
          canWrite && (
            <>
              {archived ? (
                <Button
                  size="sm"
                  disabled
                  title={ARCHIVED_WRITE_REASON}
                  iconLeft={<Pencil aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
                >
                  Edit
                </Button>
              ) : (
                <ButtonLink
                  size="sm"
                  to={`/collections/${loaded.id}/edit`}
                  iconLeft={<Pencil aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
                >
                  Edit
                </ButtonLink>
              )}
              <Button
                size="sm"
                variant="danger-soft"
                disabled={archived}
                title={archived ? ARCHIVED_WRITE_REASON : undefined}
                iconLeft={<Trash2 aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
                onClick={() => {
                  setDeleting(true);
                }}
              >
                Delete
              </Button>
            </>
          )
        }
      />

      <Tabs<TabKey>
        label="Collection sections"
        idPrefix={TAB_PREFIX}
        value={tab}
        onChange={(key) => {
          patchSearch({ tab: key === 'overview' ? null : key });
        }}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'fields', label: 'Fields', count: loaded.fieldCount },
          {
            key: 'assignments',
            label: 'Variable assignments',
            count: loaded.variableAssignments.length,
          },
        ]}
      />

      <div {...tabPanelProps(TAB_PREFIX, tab)}>
        {tab === 'overview' && <CollectionOverview collection={loaded} />}
        {tab === 'fields' && (
          <CollectionFieldsTab
            collectionId={loaded.id}
            page={fieldsPage}
            pageSize={fieldsPageSize}
            reloadKey={loaded.updatedAt}
            onPageChange={(page) => {
              patchSearch({ fpage: page === 1 ? null : String(page) });
            }}
            onPageSizeChange={(size) => {
              patchSearch({
                fsize: size === DEFAULT_FIELDS_PAGE_SIZE ? null : String(size),
                fpage: null,
              });
            }}
          />
        )}
        {tab === 'assignments' && (
          <CollectionAssignmentsTab assignments={loaded.variableAssignments} />
        )}
      </div>

      {deleting && (
        <DeleteCollectionModal
          collection={loaded}
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
