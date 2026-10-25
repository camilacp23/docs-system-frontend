// VariableDetailPage: /variables/:id (S-11). Header with the name, scope, environments and last update, the Edit
// action (not for the Reader), the "where it is used" cards from GET /variables/{id}/dependencies and the Details
// card. The variable and its dependencies load separately: if the dependencies fail only their cards show the
// error. A variable of another application than the selected one selects that application and says so (D-78);
// switching application from the shell while the page is open goes back to the list.
// The breadcrumb reads "Variables / <name>". Loading shows a skeleton after 300 ms; unknown id: "This variable
// doesn't exist" (S-41a); other failures: the server error state with a retry.
import { Pencil } from 'lucide-react';
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
  Skeleton,
  Tag,
  useDelayedLoading,
} from '../../components/ui';
import { ARCHIVED_WRITE_REASON } from '../../hooks/useWriteBlock';
import { useBreadcrumbLabel } from '../../layout/breadcrumbContext';
import { useCurrentUser } from '../../session/useCurrentUser';

import { parseId } from './parseId';
import { VariableDetailsCard } from './VariableDetailsCard';
import { formatTimestamp, SCOPE_LABEL } from './variableLabels';
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
  useBreadcrumbLabel(loaded === null ? null : `Variables / ${loaded.name}`);
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="truncate text-page-title font-extrabold text-ink-900">{loaded.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Tag>{SCOPE_LABEL[loaded.scope]}</Tag>
            {loaded.environments.map((environment) => (
              <Tag key={environment} tone={environment === 'PROD' ? 'success' : 'neutral'}>
                {environment}
              </Tag>
            ))}
            <span className="text-label text-ink-500">
              Updated {formatTimestamp(loaded.updatedAt)}
            </span>
          </div>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            {archived ? (
              <Button
                variant="primary"
                disabled
                title={ARCHIVED_WRITE_REASON}
                iconLeft={<Pencil aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
              >
                Edit
              </Button>
            ) : (
              <ButtonLink
                to={`/variables/${loaded.id}/edit`}
                variant="primary"
                iconLeft={<Pencil aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
              >
                Edit
              </ButtonLink>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start gap-4">
        <div className="flex flex-col gap-4">
          <VariableUsage variable={loaded} dependencies={dependencies} />
        </div>
        <VariableDetailsCard variable={loaded} />
      </div>
    </>
  );
}
