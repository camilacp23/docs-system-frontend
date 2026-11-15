// VariableEditPage: /variables/:id/edit (S-12b, S-44). The complete form of a variable on its own page.
// Not for the Reader (the route guard shows S-41b; the API enforces it too).
// Saving sends the COMPLETE representation with If-Match = the ETag of the last read (PUT /variables/{id}).
//  - 412 (S-44): the form keeps what the user edited, Save is disabled and the banner offers "Reload" (loads the
//    other person's version into the form) or "Keep my changes visible" (hides the banner so the user can copy).
//  - Errors go to the exact field: DUPLICATE_NAME on the name, INVALID_ORIGIN_SCREEN and CONTEXT_SCREEN_MISMATCH on
//    the origin screen, a repeated environment on its row, validation errors by rule on each field.
//  - SCOPE_CONFLICT: the banner shows the catalog message; the dependencies are read AGAIN (not the copy of when the
//    page opened) to name the collections and write "Scope conflicts with N <function> assignment(s)." under the
//    scope. If that read fails only the banner shows.
// Save is disabled with the reason when the application is archived or the browser is offline. On success a toast
// says "Variable saved." and the page goes to the detail. The breadcrumb reads "<name> / Edit".
import { Pencil } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { isApiError, type ApiError } from '../../api/ApiError';
import { getErrorMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import { useApplication } from '../../application/useApplication';
import { useFollowElementApplication } from '../../application/useFollowElementApplication';
import {
  Banner,
  Button,
  ButtonLink,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHeader,
  Skeleton,
  useDelayedLoading,
  useToast,
} from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';
import { useBreadcrumbLabel } from '../../layout/breadcrumbContext';

import { focusFirstInvalid } from './focusFirstInvalid';
import { parseId } from './parseId';
import { useScreenOptions } from './useScreenOptions';
import { VariableFields } from './VariableFields';
import {
  hasErrors,
  toVariableWrite,
  validateVariable,
  valuesFromVariable,
  type VariableFormErrors,
  type VariableFormValues,
} from './variableForm';
import {
  mapVariableError,
  scopeConflictFieldText,
  scopeConflictImpact,
  type ScopeConflictImpact,
} from './variableErrors';
import type { Variable } from './variableTypes';

const LIST_PATH = '/variables';
const CONFLICT_EXTRA = 'Your changes will be lost, so copy anything you need first.';

export function VariableEditPage() {
  const { id: rawId } = useParams();
  const id = parseId(rawId);
  const client = useApi();
  const navigate = useNavigate();
  const toast = useToast();
  const { blocked, reason } = useWriteBlock();
  const { applications, currentApplication } = useApplication();
  const reasonId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const errorBannerRef = useRef<HTMLDivElement>(null);

  const variable = useApiResource<Variable>(
    `variable-edit:${id}`,
    async (signal) => {
      const result = await client.get('/variables/{id}', { path: { id: id ?? 0 }, signal });
      return { body: result.body.data, etag: result.etag };
    },
    id !== null,
  );
  const loaded = variable.status === 'ready' ? variable.data : null;
  const screens = useScreenOptions(loaded?.applicationId ?? null);
  useFollowElementApplication(loaded?.applicationId ?? null, LIST_PATH);
  useBreadcrumbLabel(loaded === null ? null : loaded.name);
  const { showSkeleton } = useDelayedLoading(variable.loading && id !== null);

  // What the user edited, tagged with the version it started from: reloading (a new ETag) discards it.
  const [draft, setDraft] = useState<{ key: string; values: VariableFormValues } | null>(null);
  const [errors, setErrors] = useState<VariableFormErrors>({});
  const [errorToken, setErrorToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<ApiError | null>(null);
  const [conflictHidden, setConflictHidden] = useState(false);
  const [scopeImpact, setScopeImpact] = useState<ScopeConflictImpact | null>(null);

  useEffect(() => {
    if (errorToken === 0) return;
    focusFirstInvalid(formRef.current);
    // The banner sits above the form and the user has usually scrolled down to Save: bring it back into view
    // (after the focus, which scrolls to the field), or the message is announced but never seen.
    errorBannerRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [errorToken]);

  const dataKey = `${variable.etag ?? ''}|${loaded?.updatedAt ?? ''}`;
  const values: VariableFormValues | null =
    loaded === null
      ? null
      : draft !== null && draft.key === dataKey
        ? draft.values
        : valuesFromVariable(loaded);

  const fail = (next: VariableFormErrors) => {
    setErrors(next);
    setErrorToken((token) => token + 1);
  };

  const reloadTheirVersion = () => {
    setDraft(null);
    setConflict(null);
    setConflictHidden(false);
    setErrors({});
    setScopeImpact(null);
    variable.reload();
  };

  const showScopeConflict = async (error: ApiError, base: VariableFormErrors) => {
    fail(base);
    setScopeImpact(null);
    try {
      // A fresh read: the assignments may have changed since the page was opened.
      const { body } = await client.get('/variables/{id}/dependencies', { path: { id: id ?? 0 } });
      const impact = scopeConflictImpact(error, body.data);
      if (impact !== null && impact.count > 0) {
        setScopeImpact(impact);
        fail({ ...base, scope: scopeConflictFieldText(impact) });
      }
    } catch {
      // Only the banner with the catalog message is shown.
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || saving || conflict !== null || loaded === null || values === null) return;
    const found = validateVariable(values);
    if (hasErrors(found)) {
      fail(found);
      return;
    }
    const body = toVariableWrite(values);
    setSaving(true);
    setErrors({});
    setScopeImpact(null);
    try {
      await client.put('/variables/{id}', {
        path: { id: loaded.id },
        ifMatch: variable.etag ?? undefined,
        body,
      });
      toast.show({ message: 'Variable saved.' });
      void navigate(`/variables/${loaded.id}`);
    } catch (thrown) {
      if (!isApiError(thrown)) {
        fail({ form: 'Something went wrong on our side. Try again in a moment.' });
      } else if (thrown.code === 'PRECONDITION_FAILED') {
        setConflict(thrown);
        setConflictHidden(false);
      } else if (thrown.code === 'SCOPE_CONFLICT') {
        await showScopeConflict(thrown, mapVariableError(thrown, body));
      } else {
        fail(mapVariableError(thrown, body));
      }
    } finally {
      setSaving(false);
    }
  };

  if (id === null || variable.error?.code === 'NOT_FOUND') {
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
  if (loaded === null || values === null) {
    return showSkeleton ? (
      <div role="status" aria-label="Loading" className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    ) : null;
  }

  const conflictMessage =
    conflict === null ? null : (getErrorMessage(conflict, { element: 'variable' }) ?? '');
  const saveReason = conflict !== null ? conflictMessage : reason;

  return (
    <>
      <PageHeader
        icon={<Pencil size={18} strokeWidth={ICON_STROKE_WIDTH} />}
        title={
          <>
            Edit <span className="font-mono text-body-lg font-semibold">{loaded.name}</span>
          </>
        }
        description="Update the details below and save your changes."
      />

      {conflict !== null && !conflictHidden && (
        <Banner
          tone="warning"
          actions={
            <>
              <Button
                size="sm"
                onClick={() => {
                  setConflictHidden(true);
                }}
              >
                Keep my changes visible
              </Button>
              <Button size="sm" variant="primary" onClick={reloadTheirVersion}>
                Reload
              </Button>
            </>
          }
        >
          {conflictMessage} {CONFLICT_EXTRA}
        </Banner>
      )}
      {errors.form && (
        <div ref={errorBannerRef}>
          <Banner tone="danger">
            {errors.form}
            {scopeImpact !== null &&
              scopeImpact.collections.map((collection) => (
                <span key={collection.id}>
                  {' '}
                  <Link
                    to={`/collections/${collection.id}`}
                    className="font-mono text-label font-semibold underline"
                  >
                    {collection.name}
                  </Link>
                </span>
              ))}
          </Banner>
        </div>
      )}

      <form
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          void submit(event);
        }}
        className="flex flex-col gap-4"
      >
        <VariableFields
          layout="page"
          values={values}
          onChange={(next) => {
            setDraft({ key: dataKey, values: next });
          }}
          errors={errors}
          screens={screens.data ?? []}
          applicationName={
            applications.find((application) => application.id === loaded.applicationId)?.name ??
            currentApplication?.name ??
            ''
          }
          disabled={saving}
        />
        <div className="flex items-center justify-end gap-3">
          {saveReason && (
            <p id={reasonId} className="mr-auto text-small text-warning-ink">
              {saveReason}
            </p>
          )}
          <ButtonLink to={`/variables/${loaded.id}`}>Cancel</ButtonLink>
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            disabled={blocked || conflict !== null}
            aria-describedby={saveReason ? reasonId : undefined}
          >
            Save changes
          </Button>
        </div>
      </form>
    </>
  );
}
