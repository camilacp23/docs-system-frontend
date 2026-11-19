// VariableFields: the fields of a variable, shared by the creation modal (S-12a, layout 'modal') and the edit page
// (S-12b, layout 'page', two columns). Props: layout, values, onChange(next values), errors (VariableFormErrors:
// each message sits under its field and the field is marked invalid), screens (origin screen options),
// applicationName ("Unique in <application>"), disabled (while saving), nameRef (first field, for the focus).
// A context variable cannot use App (OnStart) as origin: the option is disabled and the field says why.
// The fields come in three groups (Basics, Environment setup, Documentation): cards on the page, headed blocks in the modal.
// Identifiers (the name) are in IBM Plex Mono. Every control has a label; errors are linked with aria-describedby.
import { FileText, Layers, ListTree } from 'lucide-react';
import type { RefObject } from 'react';

import {
  FormField,
  ICON_STROKE_WIDTH,
  SegmentedControl,
  Select,
  Textarea,
  TextField,
} from '../../components/ui';
import { EnvironmentsGroup, FieldGroup } from '../shared/EnvironmentsGroup';
import { ModalGroup } from '../shared/ModalGroup';
import { PageBand } from '../shared/PageBand';

import { FIELD_LABEL, NAME_MAX_LENGTH, withScope } from './variableForm';
import type { VariableFormErrors, VariableFormValues } from './variableForm';
import {
  APP_SCREEN_LABEL,
  DATA_TYPES,
  DATA_TYPE_LABEL,
  SCOPE_FUNCTION,
  SCOPE_LABEL,
  SCOPES,
} from './variableLabels';
import type { DataType, ScreenSummary } from './variableTypes';

export const CONTEXT_APP_ORIGIN_TEXT = "Context variables can't originate in App (OnStart).";
export const CONTEXT_SCOPE_HELP =
  'Context variables exist only in the screen where they are created.';
export const ORIGIN_HELP = 'Leave empty if unknown; the variable is then untraced.';
export const ORIGIN_USED_IN_HELP =
  'Where in the origin screen it is created, e.g. OnVisible or btnGuardar.OnSelect. Optional.';
export const ORIGIN_USED_IN_NEEDS_ORIGIN = 'Choose the origin screen first, or leave this empty.';

interface VariableFieldsProps {
  layout: 'modal' | 'page';
  values: VariableFormValues;
  onChange: (next: VariableFormValues) => void;
  errors: VariableFormErrors;
  screens: readonly ScreenSummary[];
  applicationName: string;
  disabled?: boolean;
  nameRef?: RefObject<HTMLInputElement | null>;
}

export function VariableFields({
  layout,
  values,
  onChange,
  errors,
  screens,
  applicationName,
  disabled = false,
  nameRef,
}: VariableFieldsProps) {
  const set = (patch: Partial<VariableFormValues>) => {
    onChange({ ...values, ...patch });
  };
  const isContext = values.scope === 'CONTEXT';
  const page = layout === 'page';

  const name = (
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
          disabled={disabled}
          value={values.name}
          onChange={(event) => {
            set({ name: event.target.value });
          }}
        />
      )}
    </FormField>
  );

  const dataType = (
    <FormField label={FIELD_LABEL.dataType} required error={errors.dataType}>
      {(control) => (
        <Select
          {...control}
          disabled={disabled}
          value={values.dataType}
          onChange={(event) => {
            set({ dataType: event.target.value as DataType | '' });
          }}
        >
          {values.dataType === '' && <option value="">Choose a data type</option>}
          {DATA_TYPES.map((type) => (
            <option key={type} value={type}>
              {DATA_TYPE_LABEL[type]}
            </option>
          ))}
        </Select>
      )}
    </FormField>
  );

  const scope = (
    <FieldGroup
      legend={FIELD_LABEL.scope}
      required
      help={isContext ? CONTEXT_SCOPE_HELP : undefined}
      error={errors.scope}
    >
      {(describedBy) => (
        <SegmentedControl
          name={`variable-scope-${layout}`}
          label={FIELD_LABEL.scope}
          value={values.scope}
          disabled={disabled}
          invalid={Boolean(errors.scope)}
          aria-describedby={describedBy}
          onChange={(scopeValue) => {
            onChange(withScope(values, scopeValue, screens));
          }}
          options={SCOPES.map((value) => ({
            value,
            label: `${SCOPE_LABEL[value]} (${SCOPE_FUNCTION[value]})`,
          }))}
        />
      )}
    </FieldGroup>
  );

  const origin = (
    <FormField
      label={FIELD_LABEL.originScreenId}
      error={errors.originScreenId}
      help={
        isContext ? (
          <>
            {CONTEXT_APP_ORIGIN_TEXT} {ORIGIN_HELP}
          </>
        ) : (
          ORIGIN_HELP
        )
      }
    >
      {(control) => (
        <Select
          {...control}
          disabled={disabled}
          value={values.originScreenId}
          onChange={(event) => {
            set({ originScreenId: event.target.value });
          }}
        >
          <option value="">None (untraced)</option>
          {screens.map((screen) => (
            <option
              key={screen.id}
              value={screen.id}
              disabled={isContext && screen.isAppContext}
              title={isContext && screen.isAppContext ? CONTEXT_APP_ORIGIN_TEXT : undefined}
            >
              {screen.isAppContext ? APP_SCREEN_LABEL : screen.name}
            </option>
          ))}
        </Select>
      )}
    </FormField>
  );

  const noOrigin = values.originScreenId === '';
  const originUsedIn = (
    <FormField
      label={FIELD_LABEL.originUsedIn}
      error={errors.originUsedIn}
      help={noOrigin ? ORIGIN_USED_IN_NEEDS_ORIGIN : ORIGIN_USED_IN_HELP}
    >
      {(control) => (
        <TextField
          {...control}
          mono
          autoComplete="off"
          spellCheck={false}
          placeholder="OnVisible"
          disabled={disabled || noOrigin}
          value={noOrigin ? '' : values.originUsedIn}
          onChange={(event) => {
            set({ originUsedIn: event.target.value });
          }}
        />
      )}
    </FormField>
  );

  const environments = (
    <EnvironmentsGroup
      layout={layout}
      columns={1}
      values={values.environments}
      onChange={(next) => {
        set({ environments: next });
      }}
      error={errors.environments}
      rowErrors={errors.environmentRows}
      disabled={disabled}
    />
  );

  const description = (
    <FormField label={FIELD_LABEL.description} error={errors.description}>
      {(control) =>
        page ? (
          <Textarea
            {...control}
            rows={3}
            disabled={disabled}
            value={values.description}
            onChange={(event) => {
              set({ description: event.target.value });
            }}
          />
        ) : (
          <TextField
            {...control}
            placeholder="What the variable holds and when it changes"
            disabled={disabled}
            value={values.description}
            onChange={(event) => {
              set({ description: event.target.value });
            }}
          />
        )
      }
    </FormField>
  );

  if (page) {
    return (
      <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card">
        <PageBand
          step={1}
          tone="accent"
          title="Basics"
          label="Basics"
          description="Name, type, scope and where it is created."
        >
          <div className="grid grid-cols-3 gap-x-4 gap-y-4">
            <div className="col-span-2">{name}</div>
            {dataType}
            <div className="col-span-2">{scope}</div>
            {origin}
            <div className="col-span-2">{originUsedIn}</div>
          </div>
        </PageBand>
        <PageBand
          step={2}
          tone="success"
          title="Environment setup"
          label="Environment setup"
          description="Where it exists and how it differs."
        >
          <EnvironmentsGroup
            layout="page"
            columns={2}
            values={values.environments}
            onChange={(next) => {
              set({ environments: next });
            }}
            error={errors.environments}
            rowErrors={errors.environmentRows}
            disabled={disabled}
          />
        </PageBand>
        <PageBand
          step={3}
          tone="neutral"
          title="Documentation"
          label="Documentation"
          description="What it holds and when it changes."
        >
          {description}
        </PageBand>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-x-8">
      <ModalGroup title="Basics" icon={<ListTree size={13} strokeWidth={ICON_STROKE_WIDTH} />}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          {name}
          {dataType}
          <div className="col-span-2">{scope}</div>
          <div className="col-span-2">{origin}</div>
          <div className="col-span-2">{originUsedIn}</div>
        </div>
      </ModalGroup>
      <div className="flex flex-col gap-5 border-t border-divider pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
        <ModalGroup
          title="Environment setup"
          icon={<Layers size={13} strokeWidth={ICON_STROKE_WIDTH} />}
        >
          {environments}
        </ModalGroup>
        <ModalGroup
          title="Documentation"
          icon={<FileText size={13} strokeWidth={ICON_STROKE_WIDTH} />}
        >
          {description}
        </ModalGroup>
      </div>
    </div>
  );
}
