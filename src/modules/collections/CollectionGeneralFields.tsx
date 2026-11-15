// CollectionGeneralFields: name, description, creation condition and environments of a collection, shared by the
// creation modal (S-14n, layout 'modal': General | Environment setup in two columns) and the edit page (S-16, layout 'page',
// the "General" band).
// Props: layout, values, onChange(next values), errors (CollectionFormErrors: each message sits under its field and
// the field is marked invalid), applicationName ("Unique in <application>"), disabled (while saving), nameRef (first
// field, for the focus). The name and the creation condition are Power Apps identifiers / formulas: IBM Plex Mono.
import { Layers, ListTree } from 'lucide-react';
import type { RefObject } from 'react';

import { FormField, ICON_STROKE_WIDTH, Textarea, TextField } from '../../components/ui';
import { EnvironmentsGroup } from '../shared/EnvironmentsGroup';
import { ModalGroup } from '../shared/ModalGroup';

import {
  FIELD_LABEL,
  NAME_MAX_LENGTH,
  type CollectionFormErrors,
  type CollectionFormValues,
} from './collectionForm';

interface CollectionGeneralFieldsProps {
  layout: 'modal' | 'page';
  values: CollectionFormValues;
  onChange: (next: CollectionFormValues) => void;
  errors: CollectionFormErrors;
  applicationName: string;
  disabled?: boolean;
  nameRef?: RefObject<HTMLInputElement | null>;
}

export function CollectionGeneralFields({
  layout,
  values,
  onChange,
  errors,
  applicationName,
  disabled = false,
  nameRef,
}: CollectionGeneralFieldsProps) {
  const set = (patch: Partial<CollectionFormValues>) => {
    onChange({ ...values, ...patch });
  };
  const page = layout === 'page';

  const nameField = (
    <FormField
      label={FIELD_LABEL.name}
      required
      error={errors.name}
      help={
        <span className="flex justify-between gap-2">
          <span>{page ? '' : `Unique in ${applicationName}`}</span>
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
          disabled={disabled}
          value={values.name}
          onChange={(event) => {
            set({ name: event.target.value });
          }}
        />
      )}
    </FormField>
  );
  const descriptionField = (
    <FormField label={FIELD_LABEL.description} error={errors.description}>
      {(control) => (
        <TextField
          {...control}
          placeholder="What the collection holds"
          disabled={disabled}
          value={values.description}
          onChange={(event) => {
            set({ description: event.target.value });
          }}
        />
      )}
    </FormField>
  );
  const conditionField = (
    <FormField label={FIELD_LABEL.creationCondition} error={errors.creationCondition}>
      {(control) => (
        <Textarea
          {...control}
          rows={2}
          className="font-mono text-label"
          spellCheck={false}
          disabled={disabled}
          value={values.creationCondition}
          onChange={(event) => {
            set({ creationCondition: event.target.value });
          }}
        />
      )}
    </FormField>
  );
  const environments = (
    <EnvironmentsGroup
      layout={layout}
      columns={page ? 2 : 1}
      values={values.environments}
      onChange={(next) => {
        set({ environments: next });
      }}
      error={errors.environments}
      rowErrors={errors.environmentRows}
      disabled={disabled}
    />
  );

  if (page) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          {nameField}
          {descriptionField}
        </div>
        {conditionField}
        {environments}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-x-8">
      <ModalGroup title="General" icon={<ListTree size={13} strokeWidth={ICON_STROKE_WIDTH} />}>
        <div className="flex flex-col gap-4">
          {nameField}
          {descriptionField}
          {conditionField}
        </div>
      </ModalGroup>
      <div className="border-t border-divider pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
        <ModalGroup
          title="Environment setup"
          icon={<Layers size={13} strokeWidth={ICON_STROKE_WIDTH} />}
        >
          {environments}
        </ModalGroup>
      </div>
    </div>
  );
}
