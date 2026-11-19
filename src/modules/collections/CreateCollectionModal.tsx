// CreateCollectionModal: "New collection" over the list (S-14n, D-57). Rendered only while it is open (its state
// starts fresh each time). Props: onClose, onCreated (called after the collection was created, to reload the list).
// The form asks for what identifies the collection: name, description, creation condition, environments and its
// fields (Figure 13); the variable assignments are added afterwards in the edit page (S-16), where the context-screen
// rule is applied (D-52). The POST is the complete body of the contract (POST /collections) with the selected
// application and empty `variableAssignments` and `derivedFrom`.
// Client checks cover only what the contract declares; every other rule is the server's and its error is shown on
// the exact field or row (DUPLICATE_NAME on the name, a repeated field name on its row, a repeated environment on
// its card). Saving is disabled with the reason when the application is archived or the browser is offline.
// On success a toast says "<name> created." with an Open action.
import { Database, Info, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { isApiError } from '../../api/ApiError';
import { useApi } from '../../api/useApi';
import { useApplication } from '../../application/useApplication';
import { Banner, Button, ICON_STROKE_WIDTH, Modal, useToast } from '../../components/ui';
import { useWriteBlock } from '../../hooks/useWriteBlock';
import { focusFirstInvalid } from '../variables/focusFirstInvalid';

import { CollectionGeneralFields } from './CollectionGeneralFields';
import { mapCollectionError } from './collectionErrors';
import {
  emptyCollectionValues,
  hasErrors,
  submittedRows,
  toCollectionWrite,
  validateCollection,
  type CollectionFormErrors,
  type CollectionFormValues,
} from './collectionForm';
import { FieldRowsEditor } from './FieldRowsEditor';

interface CreateCollectionModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateCollectionModal({ onClose, onCreated }: CreateCollectionModalProps) {
  const client = useApi();
  const { currentApplication } = useApplication();
  const toast = useToast();
  const navigate = useNavigate();
  const { blocked, reason } = useWriteBlock();
  const formId = useId();
  const reasonId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<CollectionFormValues>(emptyCollectionValues);
  const [errors, setErrors] = useState<CollectionFormErrors>({});
  const [errorToken, setErrorToken] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (errorToken > 0) focusFirstInvalid(formRef.current);
  }, [errorToken]);

  const fail = (next: CollectionFormErrors) => {
    setErrors(next);
    setErrorToken((token) => token + 1);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || saving || currentApplication === null) return;
    const found = validateCollection(values);
    if (hasErrors(found)) {
      fail(found);
      return;
    }
    const body = toCollectionWrite(values);
    const rows = submittedRows(values);
    setSaving(true);
    try {
      const { body: created } = await client.post('/collections', {
        body: { applicationId: currentApplication.id, ...body },
      });
      const { id, name } = created.data;
      toast.show({
        message: `${name} created.`,
        action: {
          label: 'Open',
          onClick: () => {
            void navigate(`/collections/${id}`);
          },
        },
      });
      onCreated();
      onClose();
    } catch (thrown) {
      if (isApiError(thrown)) fail(mapCollectionError(thrown, rows));
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
      icon={<Database size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      title={
        <span className="flex flex-col">
          <span>New collection</span>
          <span className="text-small font-normal text-ink-500">
            {applicationName} · {currentApplication?.platform ?? 'Power Apps'} collection
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
                  Variable assignments come next
                </span>
                Add them after creating, from Edit collection.
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
              aria-label="Create collection"
              iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
            >
              Create
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
        <CollectionGeneralFields
          layout="modal"
          values={values}
          onChange={setValues}
          errors={errors}
          applicationName={applicationName}
          disabled={saving}
          nameRef={nameRef}
        />
        <div className="border-t border-divider pt-5">
          <FieldRowsEditor
            layout="modal"
            rows={values.fields}
            onChange={(fields) => {
              setValues({ ...values, fields });
            }}
            errors={errors.fieldRows}
            groupError={errors.fields}
            disabled={saving}
          />
        </div>
      </form>
    </Modal>
  );
}
