// CreateVariableModal: "New variable" over the list (S-12a, D-57). Rendered only while it is open (its state starts
// fresh each time). Props: onClose, onCreated (called after the variable was created, to reload the list), screens
// (origin screen options). The form asks for what identifies the variable and its environments; the POST is the
// complete body of the contract (POST /variables) with the selected application.
// Client checks cover only what the contract declares; every other rule is the server's and its error is shown on
// the exact field (DUPLICATE_NAME on the name, INVALID_ORIGIN_SCREEN on the origin screen, a repeated environment on
// its row). Saving is disabled with the reason when the application is archived or the browser is offline.
// On success a toast says "<name> created." with an Open action.
import { Braces, Info, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { isApiError } from '../../api/ApiError';
import { useApi } from '../../api/useApi';
import { useApplication } from '../../application/useApplication';
import { Banner, Button, ICON_STROKE_WIDTH, Modal, useToast } from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';

import { focusFirstInvalid } from './focusFirstInvalid';
import { VariableFields } from './VariableFields';
import {
  emptyValues,
  hasErrors,
  toVariableWrite,
  validateVariable,
  type VariableFormErrors,
  type VariableFormValues,
} from './variableForm';
import { mapVariableError } from './variableErrors';
import type { ScreenSummary } from './variableTypes';

interface CreateVariableModalProps {
  onClose: () => void;
  onCreated: () => void;
  screens: readonly ScreenSummary[];
}

export function CreateVariableModal({ onClose, onCreated, screens }: CreateVariableModalProps) {
  const client = useApi();
  const { currentApplication } = useApplication();
  const toast = useToast();
  const navigate = useNavigate();
  const { blocked, reason } = useWriteBlock();
  const formId = useId();
  const reasonId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<VariableFormValues>(emptyValues);
  const [errors, setErrors] = useState<VariableFormErrors>({});
  const [errorToken, setErrorToken] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (errorToken > 0) focusFirstInvalid(formRef.current);
  }, [errorToken]);

  const fail = (next: VariableFormErrors) => {
    setErrors(next);
    setErrorToken((token) => token + 1);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || saving || currentApplication === null) return;
    const found = validateVariable(values);
    if (hasErrors(found)) {
      fail(found);
      return;
    }
    const body = toVariableWrite(values);
    setSaving(true);
    try {
      const { body: created } = await client.post('/variables', {
        body: { applicationId: currentApplication.id, ...body },
      });
      const { id, name } = created.data;
      toast.show({
        message: `${name} created.`,
        action: {
          label: 'Open',
          onClick: () => {
            void navigate(`/variables/${id}`);
          },
        },
      });
      onCreated();
      onClose();
    } catch (thrown) {
      if (isApiError(thrown)) fail(mapVariableError(thrown, body));
      else fail({ form: 'Something went wrong on our side. Try again in a moment.' });
    } finally {
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
      size="xl"
      initialFocusRef={nameRef}
      icon={<Braces size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      title={
        <span className="flex flex-col">
          <span>New variable</span>
          <span className="text-small font-normal text-ink-500">
            {applicationName} · Global or context variable
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
                  Usage is linked from each screen
                </span>
                Reads and writes are added in the screen or the collection.
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
              Create variable
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
        {errors.form && <Banner tone="danger">{errors.form}</Banner>}
        <VariableFields
          layout="modal"
          values={values}
          onChange={setValues}
          errors={errors}
          screens={screens}
          applicationName={applicationName}
          disabled={saving}
          nameRef={nameRef}
        />
      </form>
    </Modal>
  );
}
