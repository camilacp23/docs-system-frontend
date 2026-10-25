// CollectionGeneralFields: name, description, creation condition and environments of a collection, shared by the
// creation modal (S-14n, layout 'modal') and the edit page (S-16, layout 'page', the "General" card).
// Props: layout, values, onChange(next values), errors (CollectionFormErrors: each message sits under its field and
// the field is marked invalid), applicationName ("Unique in <application>"), disabled (while saving), nameRef (first
// field, for the focus). The name and the creation condition are Power Apps identifiers / formulas: IBM Plex Mono.
import type { RefObject } from 'react';

import { FormField, Textarea, TextField } from '../../components/ui';
import { EnvironmentsGroup } from '../shared/EnvironmentsGroup';

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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
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
      </div>
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
      <EnvironmentsGroup
        layout={layout}
        values={values.environments}
        onChange={(next) => {
          set({ environments: next });
        }}
        error={errors.environments}
        rowErrors={errors.environmentRows}
        disabled={disabled}
      />
    </div>
  );
}
