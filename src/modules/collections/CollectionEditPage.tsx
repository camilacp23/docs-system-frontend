// CollectionEditPage: /collections/:id/edit (S-16, S-44). The complete form of a collection on its own page: General
// (name, description, creation condition, environments), Fields, Variable assignments and Derived from.
// Not for the Reader (the route guard shows S-41b; the API enforces it too).
// Saving sends the COMPLETE representation with If-Match = the ETag of the last read (PUT /collections/{id}): the
// three arrays `fields`, `variableAssignments` and `derivedFrom` ALWAYS travel, also the ones the user did not touch,
// because an omitted array deletes what exists. Existing items keep their id, new items go without one, a removed
// row is simply not sent, and `position` is the visible order of the fields (see collectionForm).
//  - 412 (S-44): the form keeps what the user edited, Save is disabled and the banner offers "Reload" (loads the
//    other person's version into the form) or "Keep my changes visible" (hides the banner so the user can copy).
//  - Errors go to the exact field or row (the position the server names is translated with the ROWS AS THEY WERE
//    SENT, so a row moved after the form was opened still gets its own error): collectionErrors. The form is long, so
//    a danger banner says "N fields need attention." with a link to each control (Table 58).
// Save is disabled with the reason when the application is archived or the browser is offline. On success a toast says
// "Collection saved." and the page goes to the detail. The breadcrumb reads "<name> / Edit".
import { Pencil } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';

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
import { focusFirstInvalid } from '../variables/focusFirstInvalid';
import { parseId } from '../variables/parseId';
import { useScreenOptions } from '../variables/useScreenOptions';
import { PageBand } from '../shared/PageBand';

import { AssignmentRowsEditor } from './AssignmentRowsEditor';
import { CollectionGeneralFields } from './CollectionGeneralFields';
import { mapCollectionError } from './collectionErrors';
import {
  hasErrors,
  submittedRows,
  toCollectionWrite,
  validateCollection,
  valuesFromCollection,
  type CollectionFormErrors,
  type CollectionFormValues,
} from './collectionForm';
import type { Collection } from './collectionTypes';
import { DerivedFromPicker } from './DerivedFromPicker';
import { FieldRowsEditor } from './FieldRowsEditor';
import { invalidFields, type InvalidField } from './invalidFields';
import { useCollectionOptions } from './useCollectionOptions';
import { useVariableOptions } from './useVariableOptions';

const LIST_PATH = '/collections';
const CONFLICT_EXTRA = 'Your changes will be lost, so copy anything you need first.';

/** Adds to `options` the items of `extra` it does not have yet (by id), keeping the order of `options`. */
function withExtras<T extends { id: number }>(options: readonly T[], extra: readonly T[]): T[] {
  const known = new Set(options.map((option) => option.id));
  return [...options, ...extra.filter((item) => !known.has(item.id))];
}

export function CollectionEditPage() {
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

  const collection = useApiResource<Collection>(
    `collection-edit:${id}`,
    async (signal) => {
      const result = await client.get('/collections/{id}', { path: { id: id ?? 0 }, signal });
      return { body: result.body.data, etag: result.etag };
    },
    id !== null,
  );
  const loaded = collection.status === 'ready' ? collection.data : null;
  const variables = useVariableOptions(loaded?.applicationId ?? null);
  const screens = useScreenOptions(loaded?.applicationId ?? null);
  const collections = useCollectionOptions(loaded?.applicationId ?? null);
  useFollowElementApplication(loaded?.applicationId ?? null, LIST_PATH);
  useBreadcrumbLabel(loaded === null ? null : loaded.name);
  const { showSkeleton } = useDelayedLoading(collection.loading && id !== null);

  // What the user edited, tagged with the version it started from: reloading (a new ETag) discards it.
  const [draft, setDraft] = useState<{ key: string; values: CollectionFormValues } | null>(null);
  const [errors, setErrors] = useState<CollectionFormErrors>({});
  const [summary, setSummary] = useState<InvalidField[]>([]);
  const [errorToken, setErrorToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<ApiError | null>(null);
  const [conflictHidden, setConflictHidden] = useState(false);

  useEffect(() => {
    if (errorToken === 0) return;
    setSummary(invalidFields(formRef.current));
    focusFirstInvalid(formRef.current);
    // The banner sits above the form and the user has usually scrolled down to Save: bring it back into view
    // (after the focus, which scrolls to the field), or the message is announced but never seen.
    errorBannerRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [errorToken]);

  const dataKey = `${collection.etag ?? ''}|${loaded?.updatedAt ?? ''}`;
  const values: CollectionFormValues | null =
    loaded === null
      ? null
      : draft !== null && draft.key === dataKey
        ? draft.values
        : valuesFromCollection(loaded);

  const edit = (next: CollectionFormValues) => {
    setDraft({ key: dataKey, values: next });
  };

  const fail = (next: CollectionFormErrors) => {
    setErrors(next);
    setErrorToken((token) => token + 1);
  };

  const reloadTheirVersion = () => {
    setDraft(null);
    setConflict(null);
    setConflictHidden(false);
    setErrors({});
    setSummary([]);
    collection.reload();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || saving || conflict !== null || loaded === null || values === null) return;
    const found = validateCollection(values);
    if (hasErrors(found)) {
      fail(found);
      return;
    }
    // The body and the order of its rows, taken together: a server error names a position of THIS body.
    const body = toCollectionWrite(values);
    const rows = submittedRows(values);
    setSaving(true);
    setErrors({});
    setSummary([]);
    try {
      await client.put('/collections/{id}', {
        path: { id: loaded.id },
        ifMatch: collection.etag ?? undefined,
        body,
      });
      toast.show({ message: 'Collection saved.' });
      void navigate(`/collections/${loaded.id}`);
    } catch (thrown) {
      if (!isApiError(thrown)) {
        fail({ form: 'Something went wrong on our side. Try again in a moment.' });
      } else if (thrown.code === 'PRECONDITION_FAILED') {
        setConflict(thrown);
        setConflictHidden(false);
      } else {
        fail(mapCollectionError(thrown, rows));
      }
    } finally {
      setSaving(false);
    }
  };

  if (id === null || collection.error?.code === 'NOT_FOUND') {
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
  if (loaded === null || values === null) {
    return showSkeleton ? (
      <div role="status" aria-label="Loading" className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    ) : null;
  }

  const conflictMessage =
    conflict === null ? null : (getErrorMessage(conflict, { element: 'collection' }) ?? '');
  const saveReason = conflict !== null ? conflictMessage : reason;

  const variableOptions = withExtras(
    variables.data ?? [],
    loaded.variableAssignments.map((assignment) => assignment.variable),
  );
  const screenOptions = withExtras(
    screens.data ?? [],
    loaded.variableAssignments.map((assignment) => assignment.screen),
  );
  const collectionOptions = withExtras(collections.data ?? [], loaded.derivedFrom);

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
      {(errors.form || summary.length > 0) && (
        <div ref={errorBannerRef} className="flex flex-col gap-2">
          {errors.form && <Banner tone="danger">{errors.form}</Banner>}
          {summary.length > 0 && (
            <Banner
              tone="danger"
              lead={`${summary.length} ${summary.length === 1 ? 'field needs' : 'fields need'} attention.`}
            >
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {summary.map((entry, index) => (
                  <li key={`${entry.label}-${index}`}>
                    <button
                      type="button"
                      className="rounded-chip font-semibold underline"
                      onClick={() => {
                        entry.element.focus();
                      }}
                    >
                      {entry.label}
                    </button>
                  </li>
                ))}
              </ul>
            </Banner>
          )}
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
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card">
          <PageBand
            step={1}
            tone="accent"
            title="General"
            label="General"
            description="Name, creation condition and environments."
          >
            <CollectionGeneralFields
              layout="page"
              values={values}
              onChange={edit}
              errors={errors}
              applicationName={
                applications.find((application) => application.id === loaded.applicationId)?.name ??
                currentApplication?.name ??
                ''
              }
              disabled={saving}
            />
          </PageBand>
          <PageBand
            step={2}
            tone="success"
            title="Structure"
            description="The fields of the collection, in order."
          >
            <FieldRowsEditor
              layout="page"
              rows={values.fields}
              onChange={(fields) => {
                edit({ ...values, fields });
              }}
              errors={errors.fieldRows}
              groupError={errors.fields}
              disabled={saving}
            />
          </PageBand>
          <PageBand
            step={3}
            tone="warning"
            title="Variable links"
            description="Variables it feeds, and where."
          >
            <AssignmentRowsEditor
              rows={values.assignments}
              onChange={(assignments) => {
                edit({ ...values, assignments });
              }}
              errors={errors.assignmentRows}
              groupError={errors.assignments}
              variables={variableOptions}
              screens={screenOptions}
              disabled={saving}
            />
          </PageBand>
          <PageBand
            step={4}
            tone="neutral"
            title="Lineage"
            description="Collections it is derived from."
          >
            <DerivedFromPicker
              options={collectionOptions}
              selfId={loaded.id}
              value={values.derivedFrom}
              onChange={(derivedFrom) => {
                edit({ ...values, derivedFrom });
              }}
              error={errors.derivedFrom}
              disabled={saving}
              loading={collections.loading}
            />
          </PageBand>
        </div>
        <div className="flex items-center justify-end gap-3">
          {saveReason && (
            <p id={reasonId} className="mr-auto text-small text-warning-ink">
              {saveReason}
            </p>
          )}
          <ButtonLink to={`/collections/${loaded.id}`}>Cancel</ButtonLink>
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
