// CreateScreenModal: "New screen" over the list (P-03, D-57). Rendered only while it is open (its state starts
// fresh each time). Props: onClose.
// The form asks for what identifies the screen: its name and, optionally, the link to its Miro diagram (https
// only, FR-13). The POST is the complete body of the contract (POST /screens) with the selected application, the
// template with its seven fields empty and the four lists empty; the template is completed in the screen detail.
// Client checks cover only what the contract declares; every other rule is the server's and its error is shown on
// the exact field (DUPLICATE_NAME and the format of the link). Saving is disabled with the reason when the
// application is archived or the browser is offline. On success the page goes to the new screen and a toast says
// "<name> created.".
import { Info, Layers, Link2, Monitor, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { isApiError } from '../../api/ApiError';
import { useApi } from '../../api/useApi';
import { notifyScreensChanged } from '../../application/useScreenCount';
import { useApplication } from '../../application/useApplication';
import {
  Banner,
  Button,
  FormField,
  ICON_STROKE_WIDTH,
  Modal,
  TextField,
  useToast,
} from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';
import { focusFirstInvalid } from '../variables/focusFirstInvalid';

import { mapScreenError } from './screenErrors';
import {
  emptyScreenValues,
  FIELD_LABEL,
  hasErrors,
  MIRO_LINK_MAX_LENGTH,
  NAME_MAX_LENGTH,
  toScreenCreate,
  validateScreen,
  type ScreenFormErrors,
  type ScreenFormValues,
} from './screenForm';
import { TEMPLATE_FIELDS } from './templateFields';

interface CreateScreenModalProps {
  onClose: () => void;
}

export function CreateScreenModal({ onClose }: CreateScreenModalProps) {
  const client = useApi();
  const { currentApplication } = useApplication();
  const toast = useToast();
  const navigate = useNavigate();
  const { blocked, reason } = useWriteBlock();
  const formId = useId();
  const reasonId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<ScreenFormValues>(emptyScreenValues);
  const [errors, setErrors] = useState<ScreenFormErrors>({});
  const [errorToken, setErrorToken] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (errorToken > 0) focusFirstInvalid(formRef.current);
  }, [errorToken]);

  const fail = (next: ScreenFormErrors) => {
    setErrors(next);
    setErrorToken((token) => token + 1);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || saving || currentApplication === null) return;
    const found = validateScreen(values);
    if (hasErrors(found)) {
      fail(found);
      return;
    }
    setSaving(true);
    try {
      const { body: created } = await client.post('/screens', {
        body: toScreenCreate(values, currentApplication.id),
      });
      const { id, name } = created.data;
      toast.show({ message: `${name} created.` });
      notifyScreensChanged();
      void navigate(`/screens/${id}`);
    } catch (thrown) {
      if (isApiError(thrown)) fail(mapScreenError(thrown));
      else fail({ form: 'Something went wrong on our side. Try again in a moment.' });
      setSaving(false);
    }
  };

  const applicationName = currentApplication?.name ?? '';
  return (
    <Modal
      open
      onClose={() => {
        if (!saving) onClose();
      }}
      size="md"
      initialFocusRef={nameRef}
      icon={<Monitor size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      title={
        <span className="flex flex-col">
          <span>New screen</span>
          <span className="text-small font-normal text-ink-500">
            {applicationName} · {currentApplication?.platform ?? 'Power Apps'}
          </span>
        </span>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          {reason ? (
            <p id={reasonId} className="text-small text-warning-ink">
              {reason}
            </p>
          ) : (
            <p className="flex items-start gap-2 text-small text-ink-500">
              <Info
                aria-hidden="true"
                size={16}
                strokeWidth={ICON_STROKE_WIDTH}
                className="mt-px shrink-0"
              />
              <span>
                <span className="block font-semibold text-ink-700">
                  Status after creating: Undocumented
                </span>
                You can edit everything later.
              </span>
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
              disabled={blocked}
              aria-describedby={reason ? reasonId : undefined}
              iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
            >
              Create screen
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
        className="flex flex-col gap-5"
      >
        {errors.form && <Banner tone="danger">{errors.form}</Banner>}
        <FormField
          label={FIELD_LABEL.name}
          required
          error={errors.name}
          help={
            <span className="flex justify-between gap-2">
              <span>Unique in {applicationName}</span>
              <span aria-hidden="true">
                {values.name.length}/{NAME_MAX_LENGTH}
              </span>
            </span>
          }
        >
          {(control) => (
            <TextField
              {...control}
              ref={nameRef}
              mono
              autoComplete="off"
              spellCheck={false}
              disabled={saving}
              value={values.name}
              onChange={(event) => {
                setValues({ ...values, name: event.target.value });
              }}
            />
          )}
        </FormField>
        <FormField
          label={FIELD_LABEL.miroLink}
          error={errors.miroLink}
          help="Optional · https only"
        >
          {(control) => (
            <TextField
              {...control}
              type="url"
              icon={<Link2 size={16} strokeWidth={ICON_STROKE_WIDTH} />}
              placeholder="https://miro.com/app/board/…"
              autoComplete="off"
              spellCheck={false}
              maxLength={MIRO_LINK_MAX_LENGTH}
              disabled={saving}
              value={values.miroLink}
              onChange={(event) => {
                setValues({ ...values, miroLink: event.target.value });
              }}
            />
          )}
        </FormField>
        <section
          aria-label="Template"
          className="flex flex-col gap-3 rounded-card bg-search-bg p-4 text-small text-ink-500"
        >
          <h3 className="flex items-center gap-2 text-label font-semibold text-ink-900">
            <Layers aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
            Template · {TEMPLATE_FIELDS.length} fields
          </h3>
          <p>
            You complete them in the screen detail. The screen stays Undocumented until a field has
            content, then it becomes Draft. All seven are required to submit for review.
          </p>
          <ul aria-label="Template fields" className="flex flex-wrap gap-2">
            {TEMPLATE_FIELDS.map((field) => (
              <li
                key={field.key}
                className="rounded-pill border border-border-subtle bg-surface px-2.5 py-0.5 text-label text-ink-900"
              >
                {field.label}
              </li>
            ))}
          </ul>
        </section>
      </form>
    </Modal>
  );
}
