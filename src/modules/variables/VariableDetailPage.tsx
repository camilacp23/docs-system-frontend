// VariableDetailPage: /variables/:id (S-11). Hero with the name, scope, environments and last update, the Delete and Edit
// actions (not for the Reader), the Details card across the page and the "where it is used" cards from
// GET /variables/{id}/dependencies. The variable and its dependencies load separately: if the dependencies fail only their cards show the
// error. A variable of another application than the selected one selects that application and says so (D-78);
// switching application from the shell while the page is open goes back to the list.
// The breadcrumb reads "Variables / <name>". Loading shows a skeleton after 300 ms; unknown id: "This variable
// doesn't exist" (S-41a); other failures: the server error state with a retry.
import { Braces, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

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
  Skeleton,
  useDelayedLoading,
} from '../../components/ui';
import { ARCHIVED_WRITE_REASON } from '../../hooks/useWriteBlock';
import { useBreadcrumbLabel } from '../../layout/breadcrumbContext';
import { useCurrentUser } from '../../session/useCurrentUser';

import { parseId } from './parseId';
import { DeleteVariableModal } from './DeleteVariableModal';
import { VariableDetailsCard } from './VariableDetailsCard';
import { VariableUsage } from './VariableUsage';
import type { Variable, VariableDependencies } from './variableTypes';

const LIST_PATH = '/variables';

export function VariableDetailPage() {
  const { id: rawId } = useParams();
  const id = parseId(rawId);
  const client = useApi();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { currentApplication } = useApplication();
  const canWrite = user !== null && user.role !== 'READER';
  const archived = currentApplication?.status === 'ARCHIVED';
  const [deleting, setDeleting] = useState(false);

  const variable = useApiResource<Variable>(
    `variable:${id}`,
    async (signal) => {
      const result = await client.get('/variables/{id}', { path: { id: id ?? 0 }, signal });
      return { body: result.body.data, etag: result.etag };
    },
    id !== null,
  );
  const dependencies = useApiResource<VariableDependencies>(
    `variable-dependencies:${id}`,
    async (signal) => {
      const result = await client.get('/variables/{id}/dependencies', {
        path: { id: id ?? 0 },
        signal,
      });
      return { body: result.body.data, etag: result.etag };
    },
    id !== null,
  );

  const loaded = variable.status === 'ready' ? variable.data : null;
  useFollowElementApplication(loaded?.applicationId ?? null, LIST_PATH);
  useBreadcrumbLabel(loaded === null ? null : loaded.name);
  const { showSkeleton } = useDelayedLoading(variable.loading && id !== null);

  const notFound = id === null || variable.error?.code === 'NOT_FOUND';
  if (notFound) {
    return (
      <ErrorState
        variant="not-found"
        element="variable"
        listLabel="Variables"
        className="flex-1"
        onAction={() => {
          void navigate(LIST_PATH);
        }}
      />
    );
  }
  if (variable.status === 'error') {
    return (
      <ErrorState
        variant="server-error"
        requestId={variable.error?.requestId ?? undefined}
        className="flex-1"
        onAction={variable.reload}
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
        tone="variable"
        compact
        icon={<Braces size={18} strokeWidth={ICON_STROKE_WIDTH} />}
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
                  to={`/variables/${loaded.id}/edit`}
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

      <VariableDetailsCard variable={loaded} />
      <VariableUsage variable={loaded} dependencies={dependencies} />

      {deleting && (
        <DeleteVariableModal
          variable={loaded}
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
