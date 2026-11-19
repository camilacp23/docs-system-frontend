// ApplicationFormModal: "Register application" (S-08) and "Edit application" over the list. Rendered only while it is
// open (its state starts fresh each time). Props: applicationId (omit to register), onClose, onSaved (the list and
// the applications of the shell are read again).
// Layout (the one of the New variable modal): wide, two columns of headed groups: Basics (name, platform) on the left, Jira and
// Documentation on the right; registering says in the footer that the App (OnStart) screen is created for it.
// Fields: Name (n/120, "Unique in the department."), Platform (n/60), Jira project key (empty = the department
// default project) and Description. Client checks cover what the contract declares; DUPLICATE_NAME goes under the
// name with "Documentación técnica" as the scope (D-63), the other refusals in the banner of the form.
// Editing reads GET /applications/{id} first (the list carries no ETag) and saves with PUT + If-Match and the status
// as it is. 412 (S-44): the form keeps what was typed, Save is disabled and the banner offers "Reload" (reads the
// other person's version) or "Keep my changes visible". Saving is disabled with the reason while offline. It does
// NOT depend on the selected application being active: PUT /applications is the write an archived one accepts.
import { Blocks, FileText, Info, ListTree, Plus, Ticket } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { isApiError } from '../../api/ApiError';
import { getErrorMessage } from '../../api/messages';
import { useApi } from '../../api/useApi';
import { useApiResource } from '../../api/useApiResource';
import {
  Banner,
  Button,
  FormField,
  ICON_STROKE_WIDTH,
  Modal,
  Skeleton,
  TextField,
  Textarea,
  useToast,
} from '../../components/ui';
import { useOfflineBlock } from '../../hooks/useOfflineBlock';
import { ModalGroup } from '../shared/ModalGroup';
import { focusFirstInvalid } from '../variables/focusFirstInvalid';

import {
  DESCRIPTION_MAX,
  FIELD_LABEL,
  NAME_MAX,
  PLATFORM_MAX,
  emptyApplicationValues,
  hasErrors,
  toApplicationWrite,
  validateApplication,
  valuesOf,
  type ApplicationFormErrors,
  type ApplicationFormValues,
} from './applicationForm';
import { mapApplicationError } from './applicationErrors';
import { formatTimestamp, type Application } from './applicationLabels';

interface ApplicationFormModalProps {
  applicationId?: number;
  onClose: () => void;
  onSaved: () => void;
}

const CONFLICT_EXTRA = 'Your changes will be lost, so copy anything you need first.';

export function ApplicationFormModal({
  applicationId,
  onClose,
  onSaved,
}: ApplicationFormModalProps) {
  if (applicationId === undefined) {
    return <ApplicationForm current={null} etag={null} onClose={onClose} onSaved={onSaved} />;
  }
  return <EditApplication applicationId={applicationId} onClose={onClose} onSaved={onSaved} />;
}

function EditApplication({
  applicationId,
  onClose,
  onSaved,
}: Required<Pick<ApplicationFormModalProps, 'applicationId'>> &
  Pick<ApplicationFormModalProps, 'onClose' | 'onSaved'>) {
  const client = useApi();
  const [reloads, setReloads] = useState(0);
  const resource = useApiResource<Application>(`application:${applicationId}`, async (signal) => {
    const { body, etag } = await client.get('/applications/{id}', {
      path: { id: applicationId },
      signal,
    });
    return { body: body.data, etag };
  });

  if (resource.status === 'ready' && resource.data !== null) {
    return (
      <ApplicationForm
        // A fresh copy (after "Reload") starts a fresh form.
        key={`${resource.etag ?? ''}:${reloads}`}
        current={resource.data}
        etag={resource.etag}
        onClose={onClose}
        onSaved={onSaved}
        onReload={() => {
          setReloads((count) => count + 1);
          resource.reload();
        }}
      />
    );
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      icon={<Blocks size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      title="Edit application"
    >
      {resource.status === 'error' ? (
        <Banner
          tone="danger"
          actions={
            <Button size="sm" onClick={resource.reload}>
              Try again
            </Button>
          }
        >
          {resource.error
            ? (getErrorMessage(resource.error, { element: 'application' }) ?? '')
            : ''}
        </Banner>
      ) : (
        <div aria-busy="true" className="flex flex-col gap-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}
    </Modal>
  );
}

interface ApplicationFormProps {
  /** The application being edited, or null to register a new one. */
  current: Application | null;
  etag: string | null;
  onClose: () => void;
  onSaved: () => void;
  onReload?: () => void;
}

function ApplicationForm({ current, etag, onClose, onSaved, onReload }: ApplicationFormProps) {
  const client = useApi();
  const toast = useToast();
  const { blocked, reason } = useOfflineBlock();
  const formId = useId();
  const reasonId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const editing = current !== null;

  const [values, setValues] = useState<ApplicationFormValues>(
    current === null ? emptyApplicationValues : valuesOf(current),
  );
  const [errors, setErrors] = useState<ApplicationFormErrors>({});
  const [errorToken, setErrorToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [conflictHidden, setConflictHidden] = useState(false);

  useEffect(() => {
    if (errorToken > 0) focusFirstInvalid(formRef.current);
  }, [errorToken]);

  const fail = (next: ApplicationFormErrors) => {
    setErrors(next);
    setErrorToken((token) => token + 1);
  };

  const change = (patch: Partial<ApplicationFormValues>) => {
    setValues((existing) => ({ ...existing, ...patch }));
    setErrors((existing) => {
      const next = { ...existing, form: undefined };
      for (const key of Object.keys(patch) as Array<keyof ApplicationFormValues>) {
        next[key] = undefined;
      }
      return next;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || saving || conflict !== null) return;
    const found = validateApplication(values);
    if (hasErrors(found)) {
      fail(found);
      return;
    }
    const write = toApplicationWrite(values);
    setSaving(true);
    try {
      const { body } =
        current === null
          ? await client.post('/applications', { body: write })
          : await client.put('/applications/{id}', {
              path: { id: current.id },
              ifMatch: etag ?? undefined,
              body: { ...write, status: current.status },
            });
      toast.show({ message: `${body.data.name} ${editing ? 'saved' : 'created'}.` });
      onSaved();
      onClose();
    } catch (thrown) {
      if (isApiError(thrown) && thrown.status === 412) {
        setConflict(getErrorMessage(thrown, { element: 'application' }) ?? '');
        setConflictHidden(false);
      } else if (isApiError(thrown)) {
        fail(mapApplicationError(thrown));
      } else {
        fail({ form: 'Something went wrong on our side. Try again in a moment.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const saveReason = conflict !== null ? conflict : reason;
  return (
    <Modal
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      size="xl"
      initialFocusRef={nameRef}
      icon={<Blocks size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      title={editing ? 'Edit application' : 'Register application'}
      description={
        editing
          ? `Last updated ${formatTimestamp(current.updatedAt)}`
          : 'Name, platform and Jira project of the application'
      }
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          {saveReason ? (
            <p id={reasonId} className="text-small text-warning-ink">
              {saveReason}
            </p>
          ) : editing ? (
            <span />
          ) : (
            <p className="flex items-start gap-2 text-small text-ink-500">
              <Info
                aria-hidden="true"
                size={16}
                strokeWidth={ICON_STROKE_WIDTH}
                className="mt-px shrink-0"
              />
              <span>An App (OnStart) screen is created automatically for the new application.</span>
            </p>
          )}
          <span className="flex shrink-0 items-center gap-2">
            <Button onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              variant="primary"
              loading={saving}
              disabled={blocked || conflict !== null}
              aria-describedby={saveReason ? reasonId : undefined}
              aria-label={editing ? 'Save changes' : 'Register application'}
              iconLeft={
                editing ? undefined : (
                  <Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
                )
              }
            >
              {editing ? 'Save' : 'Register'}
            </Button>
          </span>
        </div>
      }
    >
      <form
        id={formId}
        ref={formRef}
        noValidate
        onSubmit={(event) => {
          void submit(event);
        }}
        className="flex flex-col gap-4"
      >
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
                <Button size="sm" variant="primary" onClick={onReload}>
                  Reload
                </Button>
              </>
            }
          >
            {conflict} {CONFLICT_EXTRA}
          </Banner>
        )}
        {errors.form && <Banner tone="danger">{errors.form}</Banner>}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-x-8">
          <ModalGroup title="Basics" icon={<ListTree size={13} strokeWidth={ICON_STROKE_WIDTH} />}>
            <FormField
              label={FIELD_LABEL.name}
              required
              error={errors.name}
              help={
                <span className="flex justify-between gap-2">
                  <span>Unique in the department.</span>
                  <span aria-hidden="true">
                    {values.name.length}/{NAME_MAX}
                  </span>
                </span>
              }
            >
              {(control) => (
                <TextField
                  {...control}
                  ref={nameRef}
                  autoComplete="off"
                  maxLength={NAME_MAX}
                  disabled={saving}
                  value={values.name}
                  onChange={(event) => {
                    change({ name: event.target.value });
                  }}
                />
              )}
            </FormField>
            <FormField
              label={FIELD_LABEL.platform}
              required
              error={errors.platform}
              help={
                <span className="flex justify-between gap-2">
                  <span>e.g. Power Apps</span>
                  <span aria-hidden="true">
                    {values.platform.length}/{PLATFORM_MAX}
                  </span>
                </span>
              }
            >
              {(control) => (
                <TextField
                  {...control}
                  autoComplete="off"
                  maxLength={PLATFORM_MAX}
                  disabled={saving}
                  value={values.platform}
                  onChange={(event) => {
                    change({ platform: event.target.value });
                  }}
                />
              )}
            </FormField>
          </ModalGroup>
          <div className="flex flex-col gap-5 border-t border-divider pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <ModalGroup title="Jira" icon={<Ticket size={13} strokeWidth={ICON_STROKE_WIDTH} />}>
              <FormField
                label={FIELD_LABEL.jiraProjectKey}
                error={errors.jiraProjectKey}
                help="Leave empty to use the default project (TECHEA)."
              >
                {(control) => (
                  <TextField
                    {...control}
                    mono
                    autoComplete="off"
                    spellCheck={false}
                    disabled={saving}
                    value={values.jiraProjectKey}
                    onChange={(event) => {
                      change({ jiraProjectKey: event.target.value });
                    }}
                  />
                )}
              </FormField>
            </ModalGroup>
            <ModalGroup
              title="Documentation"
              icon={<FileText size={13} strokeWidth={ICON_STROKE_WIDTH} />}
            >
              <FormField label={FIELD_LABEL.description} error={errors.description}>
                {(control) => (
                  <Textarea
                    {...control}
                    rows={3}
                    maxLength={DESCRIPTION_MAX}
                    placeholder="What the application does and who uses it"
                    disabled={saving}
                    value={values.description}
                    onChange={(event) => {
                      change({ description: event.target.value });
                    }}
                  />
                )}
              </FormField>
            </ModalGroup>
          </div>
        </div>
      </form>
    </Modal>
  );
}
