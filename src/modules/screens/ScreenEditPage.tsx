// ScreenEditPage: /screens/:id/edit (S-20, S-21, S-22, S-42, S-44). The complete form of a screen on its own page, in
// three tabs kept in the URL (`?tab=components`, `?tab=links`; Template is the default and leaves no parameter):
//   Template                 the name (App (OnStart) cannot be renamed, D-87), the Miro link and the seven template fields
//   Components & navigation  the components with the variables and collections each one uses, and the navigations
//   Variables & collections  the variable links and the collection links (the origin rows are shown, never sent)
// Not for the Reader (the route guard shows S-41b; the API enforces it too).
// Saving sends the COMPLETE representation with If-Match = the ETag of the last read (PUT /screens/{id}): the four
// lists ALWAYS travel, because an omitted list is a 400; existing rows keep their id, new rows go without one and a
// removed row is simply not sent (screenEditForm).
//  - 412 (S-44): the form keeps what the user edited, Save is disabled and the banner offers "Reload" (loads the other
//    person's version into the form) or "Keep my changes visible" (hides the banner so the user can copy).
//  - Errors go to the exact field or row (the position the server names is translated with the ROWS AS THEY WERE SENT):
//    screenEditErrors. An error on another tab switches to it and puts the focus on the field. The form is long, so a
//    danger banner says "N fields need attention." with a link to each control of the tab (Table 58).
//  - An APPROVED screen shows an info banner before saving: editing it returns it to In progress (D-81).
//  - A screen IN_REVIEW opened by its URL shows the form; Save is disabled with the text of SCREEN_IN_REVIEW.
//  - Coming from "Submit for review" with an incomplete template (`?submit=1`, S-25a): while the screen is In progress,
//    a danger banner names the template fields without content ("Missing: Known issues, Risks.") and each one shows
//    "Required to submit for review."; the first one gets the focus. They are computed from the screen's own data (and
//    follow what the user types), not passed from the detail, so they survive a reload. Nothing is sent to review from
//    here: the user saves, goes back to the detail and sends it again.
// Save is disabled with the reason when the application is archived, the browser is offline or the screen is in review.
// On success a toast says "Screen saved." (and its new status when it changed) and the page goes to the detail.
// Another application selected from the shell goes back to the list (D-78). The breadcrumb reads "<name> / Edit".
import { Pencil } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { ApiError, isApiError } from '../../api/ApiError';
import { getErrorMessage, getThrownMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApplication } from '../../application/useApplication';
import { useFollowElementApplication } from '../../application/useFollowElementApplication';
import {
  Banner,
  Button,
  ButtonLink,
  DOCUMENTATION_STATUS_LABEL,
  ErrorState,
  ICON_STROKE_WIDTH,
  PageHeader,
  Skeleton,
  StatusTag,
  Tabs,
  tabPanelProps,
  useDelayedLoading,
  useToast,
} from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';
import { useBreadcrumbLabel } from '../../layout/breadcrumbContext';
import { useCollectionOptions } from '../collections/useCollectionOptions';
import { useVariableOptions } from '../collections/useVariableOptions';
import { invalidFields, type InvalidField } from '../collections/invalidFields';
import { focusFirstInvalid } from '../variables/focusFirstInvalid';
import { parseId } from '../variables/parseId';
import { useScreenOptions } from '../variables/useScreenOptions';
import { formatTimestamp } from '../variables/variableLabels';

import { ComponentRowsEditor } from './ComponentRowsEditor';
import {
  collectionOptions,
  screenOptions,
  variableAccess,
  variableOptions,
  withChosen,
} from './editOptions';
import { LinkRowsEditor, type LinkRow, type LinkRowErrors } from './LinkRowsEditor';
import { NavigationRowsEditor } from './NavigationRowsEditor';
import { editBlockReason } from './screenActionBlock';
import {
  EDIT_TABS,
  errorTab,
  hasErrors,
  submittedRows,
  toScreenUpdate,
  validateScreenEdit,
  valuesFromScreen,
  type CollectionLinkRow,
  type EditTab,
  type ScreenEditErrors,
  type ScreenEditValues,
  type VariableLinkRow,
} from './screenEditForm';
import { mapScreenEditError } from './screenEditErrors';
import { toTagStatus } from './screenLabels';
import { hasContent, TEMPLATE_FIELDS, type TemplateKey } from './templateFields';
import { ScreenTemplateFields } from './ScreenTemplateFields';
import type { Screen } from './screenTypes';
import { useScreen } from './useScreen';

const LIST_PATH = '/screens';
const TAB_PREFIX = 'screen-edit';
const CONFLICT_EXTRA = 'Your changes will be lost, so copy anything you need first.';
const APPROVED_LEAD = 'This screen is approved.';
const APPROVED_TEXT = 'Saving changes returns it to In progress.';
const SUBMIT_REQUIRED_TEXT = 'Required to submit for review.';

/** The read shape of the uses of a component: the contract types them as an intersection (pending in the contract). */
function readUses(component: Screen['components'][number]) {
  return (component.uses ?? []) as unknown as ReadonlyArray<{
    targetType: 'VARIABLE' | 'COLLECTION';
    target: { id: number; name: string };
  }>;
}

/** The row errors of the links with the element error under one name, as LinkRowsEditor reads them. */
function linkErrors(
  rows: Record<string, { accessMode?: string; usedIn?: string; row?: string }> | undefined,
  element: (key: string) => string | undefined,
): Record<string, LinkRowErrors> {
  return Object.fromEntries(
    Object.entries(rows ?? {}).map(([key, found]) => [key, { ...found, element: element(key) }]),
  );
}

export function ScreenEditPage() {
  const { id: rawId } = useParams();
  const id = parseId(rawId);
  const client = useApi();
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useSearchParams();
  const { reason: writeReason } = useWriteBlock();
  const { applications, currentApplication } = useApplication();
  const reasonId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const errorBannerRef = useRef<HTMLDivElement>(null);

  const tab: EditTab = EDIT_TABS.find((key) => key === search.get('tab')) ?? 'template';
  const screen = useScreen(id);
  const loaded = screen.status === 'ready' ? screen.data : null;
  const variables = useVariableOptions(loaded?.applicationId ?? null);
  const collections = useCollectionOptions(loaded?.applicationId ?? null);
  const screens = useScreenOptions(loaded?.applicationId ?? null);
  useFollowElementApplication(loaded?.applicationId ?? null, LIST_PATH);
  useBreadcrumbLabel(loaded === null ? null : loaded.name);
  const { showSkeleton } = useDelayedLoading(screen.loading && id !== null);

  // What the user edited, tagged with the version it started from: reloading (a new ETag) discards it.
  const [draft, setDraft] = useState<{ key: string; values: ScreenEditValues } | null>(null);
  const [errors, setErrors] = useState<ScreenEditErrors>({});
  const [summary, setSummary] = useState<InvalidField[]>([]);
  // The tab that holds the first error and must receive the focus once it is on screen.
  const pendingFocus = useRef<EditTab | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<ApiError | null>(null);
  const [conflictHidden, setConflictHidden] = useState(false);

  const setTab = (next: EditTab) => {
    setSearch((current) => {
      const params = new URLSearchParams(current);
      if (next === 'template') params.delete('tab');
      else params.set('tab', next);
      return params;
    });
  };

  // The summary lists the invalid controls of the tab on screen; it follows the errors and the tab.
  useEffect(() => {
    setSummary(hasErrors(errors) ? invalidFields(formRef.current) : []);
  }, [errors, tab]);

  // After a failed save: once the tab with the first error is the one on screen, focus its first invalid control.
  useEffect(() => {
    if (pendingFocus.current === null || pendingFocus.current !== tab) return;
    pendingFocus.current = null;
    focusFirstInvalid(formRef.current);
    // The banner sits above the form and the user has usually scrolled down to Save: bring it back into view
    // (after the focus, which scrolls to the field), or the message is announced but never seen.
    errorBannerRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [errors, tab]);

  const dataKey = `${screen.etag ?? ''}|${loaded?.updatedAt ?? ''}`;
  const values: ScreenEditValues | null =
    loaded === null
      ? null
      : draft !== null && draft.key === dataKey
        ? draft.values
        : valuesFromScreen(loaded);

  // Coming from "Submit for review" (S-25a): the template fields without content, in template order.
  const fromSubmit = search.get('submit') === '1';
  const missingForSubmit: TemplateKey[] =
    fromSubmit && values !== null && loaded?.documentationStatus === 'IN_PROGRESS'
      ? TEMPLATE_FIELDS.filter((field) => !hasContent(values.template[field.key])).map(
          (field) => field.key,
        )
      : [];
  const focusMissing = useRef(fromSubmit);
  useEffect(() => {
    if (!focusMissing.current || loaded === null || tab !== 'template') return;
    focusMissing.current = false;
    focusFirstInvalid(formRef.current);
  }, [loaded, tab]);

  const edit = (next: ScreenEditValues) => {
    setDraft({ key: dataKey, values: next });
  };

  const fail = (next: ScreenEditErrors) => {
    setErrors(next);
    const target = errorTab(next);
    if (target !== null && target !== tab) setTab(target);
    pendingFocus.current = target ?? tab;
  };

  const reloadTheirVersion = () => {
    setDraft(null);
    setConflict(null);
    setConflictHidden(false);
    setErrors({});
    setSummary([]);
    screen.reload();
  };

  const blockReason = loaded === null ? null : editBlockReason(loaded, writeReason);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blockReason !== null || saving || conflict !== null || loaded === null || values === null)
      return;
    const found = validateScreenEdit(values);
    if (hasErrors(found)) {
      fail(found);
      return;
    }
    // The body and the order of its rows, taken together: a server error names a position of THIS body.
    const body = toScreenUpdate(values);
    const rows = submittedRows(values);
    setSaving(true);
    setErrors({});
    setSummary([]);
    try {
      const result = await client.put('/screens/{id}', {
        path: { id: loaded.id },
        ifMatch: screen.etag ?? undefined,
        body,
      });
      const saved = result.body.data;
      // An update that changes nothing answers with the same status (D-71): only then there is nothing to add.
      const statusChanged = saved.documentationStatus !== loaded.documentationStatus;
      toast.show({
        message: statusChanged
          ? `Screen saved. Its status is now ${DOCUMENTATION_STATUS_LABEL[toTagStatus(saved.documentationStatus)]}.`
          : 'Screen saved.',
      });
      void navigate(`/screens/${loaded.id}`);
    } catch (thrown) {
      if (!isApiError(thrown)) {
        fail({ form: getThrownMessage(thrown) });
      } else if (thrown.code === 'PRECONDITION_FAILED') {
        setConflict(thrown);
        setConflictHidden(false);
      } else {
        fail(mapScreenEditError(thrown, rows));
      }
    } finally {
      setSaving(false);
    }
  };

  if (id === null || screen.error?.code === 'NOT_FOUND') {
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
  if (loaded === null || values === null) {
    return showSkeleton ? (
      <div role="status" aria-label="Loading" className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    ) : null;
  }

  const conflictMessage =
    conflict === null ? null : (getErrorMessage(conflict, { element: 'screen' }) ?? '');
  const saveReason = conflict !== null ? conflictMessage : blockReason;

  const variableList = variables.data ?? [];
  const uses = loaded.components.flatMap((component) => readUses(component));
  const chosenVariables = [
    ...loaded.variableLinks.filter((link) => !link.isOrigin).map((link) => link.variable),
    ...uses.filter((use) => use.targetType === 'VARIABLE').map((use) => use.target),
  ];
  const chosenCollections = [
    ...loaded.collectionLinks.map((link) => link.collection),
    ...uses.filter((use) => use.targetType === 'COLLECTION').map((use) => use.target),
  ];
  const linkVariableOptions = withChosen(
    variableOptions(variableList, loaded.id, 'link'),
    chosenVariables,
  );
  const useVariableChoices = withChosen(
    variableOptions(variableList, loaded.id, 'use'),
    chosenVariables,
  );
  const collectionChoices = withChosen(
    collectionOptions(collections.data ?? []),
    chosenCollections,
  );
  const navigationTargets = withChosen(
    screenOptions(screens.data ?? [], loaded.id),
    loaded.navigations.map((navigation) => navigation.targetScreen),
  );
  const optionsLoading = variables.loading || collections.loading || screens.loading;

  const applicationName =
    applications.find((application) => application.id === loaded.applicationId)?.name ??
    currentApplication?.name ??
    '';

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
      className="flex flex-col gap-4"
    >
      <PageHeader
        icon={<Pencil size={18} strokeWidth={ICON_STROKE_WIDTH} />}
        title={
          <>
            Edit <span className="font-mono text-body-lg font-semibold">{loaded.name}</span>
          </>
        }
        meta={
          <>
            <StatusTag status={toTagStatus(loaded.documentationStatus)} />
            <span className="text-label text-ink-500">
              Author {loaded.author.name} · Updated {formatTimestamp(loaded.updatedAt)}
            </span>
          </>
        }
        actions={
          <>
            <ButtonLink to={`/screens/${loaded.id}`}>Cancel</ButtonLink>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={blockReason !== null || conflict !== null}
              aria-describedby={saveReason ? reasonId : undefined}
            >
              Save changes
            </Button>
          </>
        }
      />
      {saveReason && (
        <p id={reasonId} className="-mt-2 text-right text-small text-warning-ink">
          {saveReason}
        </p>
      )}

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
      {missingForSubmit.length > 0 && (
        <Banner tone="danger">
          {getErrorMessage(
            new ApiError({
              status: 422,
              code: 'TEMPLATE_INCOMPLETE',
              details: { fields: missingForSubmit },
            }),
          )}
        </Banner>
      )}
      {loaded.documentationStatus === 'APPROVED' && (
        <Banner tone="info" lead={APPROVED_LEAD}>
          {APPROVED_TEXT}
        </Banner>
      )}
      {loaded.documentationStatus === 'IN_REVIEW' && (
        <Banner tone="warning">{editBlockReason(loaded, null)}</Banner>
      )}
      {(errors.form || summary.length > 0) && (
        <div ref={errorBannerRef} className="flex flex-col gap-2">
          {errors.form && <Banner tone="danger">{errors.form}</Banner>}
          {summary.length > 0 && (
            <Banner
              tone="danger"
              lead={`${summary.length} ${summary.length === 1 ? 'field needs' : 'fields need'} attention.`}
            >
              <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {summary.map((entry, index) => (
                  <button
                    key={`${entry.label}-${index}`}
                    type="button"
                    className="rounded-chip font-semibold underline"
                    onClick={() => {
                      entry.element.focus();
                    }}
                  >
                    {entry.label}
                  </button>
                ))}
              </span>
            </Banner>
          )}
        </div>
      )}

      <Tabs<EditTab>
        label="Screen sections"
        idPrefix={TAB_PREFIX}
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'template', label: 'Template' },
          { key: 'components', label: 'Components & navigation' },
          { key: 'links', label: 'Variables & collections' },
        ]}
      />

      <div {...tabPanelProps(TAB_PREFIX, tab)} className="flex flex-col gap-4">
        {tab === 'template' && (
          <ScreenTemplateFields
            values={values}
            onChange={edit}
            errors={
              missingForSubmit.length === 0
                ? errors
                : {
                    ...errors,
                    template: {
                      ...Object.fromEntries(
                        missingForSubmit.map((key) => [key, SUBMIT_REQUIRED_TEXT]),
                      ),
                      ...errors.template,
                    },
                  }
            }
            applicationName={applicationName}
            isAppContext={loaded.isAppContext}
            disabled={saving}
          />
        )}
        {tab === 'components' && (
          <>
            <ComponentRowsEditor
              rows={values.components}
              onChange={(components) => {
                edit({ ...values, components });
              }}
              errors={errors.componentRows}
              groupError={errors.components}
              variables={useVariableChoices}
              collections={collectionChoices}
              loadingOptions={optionsLoading}
              disabled={saving}
            />
            <NavigationRowsEditor
              rows={values.navigations}
              onChange={(navigations) => {
                edit({ ...values, navigations });
              }}
              errors={errors.navigationRows}
              groupError={errors.navigations}
              screens={navigationTargets}
              loadingOptions={screens.loading}
              disabled={saving}
            />
          </>
        )}
        {tab === 'links' && (
          <>
            <LinkRowsEditor
              kind="variable"
              rows={values.variableLinks}
              onChange={(rows) => {
                edit({ ...values, variableLinks: rows as VariableLinkRow[] });
              }}
              errors={linkErrors(
                errors.variableLinkRows,
                (key) => errors.variableLinkRows?.[key]?.variableId,
              )}
              groupError={errors.variableLinks}
              options={linkVariableOptions}
              accessOf={(elementId) =>
                variableAccess(
                  variableList.find((variable) => String(variable.id) === elementId),
                  loaded.id,
                )
              }
              origins={values.origins}
              loadingOptions={variables.loading}
              disabled={saving}
            />
            <LinkRowsEditor
              kind="collection"
              rows={values.collectionLinks}
              onChange={(rows: LinkRow[]) => {
                edit({ ...values, collectionLinks: rows as CollectionLinkRow[] });
              }}
              errors={linkErrors(
                errors.collectionLinkRows,
                (key) => errors.collectionLinkRows?.[key]?.collectionId,
              )}
              groupError={errors.collectionLinks}
              options={collectionChoices}
              loadingOptions={collections.loading}
              disabled={saving}
            />
          </>
        )}
      </div>
    </form>
  );
}
