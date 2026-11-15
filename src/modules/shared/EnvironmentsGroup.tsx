// EnvironmentsGroup: the "Environments" fieldset of the variable and collection forms (S-12a/b, S-14n, S-16):
// DEV and PROD checkboxes, each with its notes. Props: layout ('modal': two cards, one-line notes; 'page': stacked,
// multi-line notes), values, onChange(next), error (the group: none chosen), rowErrors (per environment), disabled.
// FieldGroup is the fieldset with legend, help and error that other groups of the forms reuse.
import { useId } from 'react';
import type { ReactNode } from 'react';

import { Checkbox, FormField, Textarea, TextField, cx } from '../../components/ui';

import {
  ENVIRONMENTS_LABEL,
  ENVIRONMENT_LIST,
  type EnvironmentErrors,
  type EnvironmentValues,
} from './environmentForm';

/** A group of related controls: a fieldset with its legend, help and error, linked with aria-describedby. */
export function FieldGroup({
  legend,
  required,
  help,
  error,
  children,
}: {
  legend: string;
  required?: boolean;
  help?: ReactNode;
  error?: string;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const id = useId();
  const describedBy = [help ? `${id}-help` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 flex gap-0.5 text-label font-medium text-ink-700">
        {legend}
        {required && (
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        )}
      </legend>
      {children(describedBy || undefined)}
      {help && (
        <p id={`${id}-help`} className="text-small text-ink-500">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-small text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

interface EnvironmentsGroupProps {
  layout: 'modal' | 'page';
  /** Cards per row; default 1 on the page layout, 2 in the modal. */
  columns?: 1 | 2;
  values: EnvironmentValues;
  onChange: (next: EnvironmentValues) => void;
  error?: EnvironmentErrors['group'];
  rowErrors?: EnvironmentErrors['rows'];
  disabled?: boolean;
}

export function EnvironmentsGroup({
  layout,
  columns,
  values,
  onChange,
  error,
  rowErrors,
  disabled = false,
}: EnvironmentsGroupProps) {
  const page = layout === 'page';
  const columnCount = columns ?? (page ? 1 : 2);
  return (
    <FieldGroup legend={ENVIRONMENTS_LABEL} required error={error}>
      {() => (
        <div
          className={cx(
            'grid items-start gap-3',
            columnCount === 1 ? 'grid-cols-1' : 'grid-cols-2',
          )}
        >
          {ENVIRONMENT_LIST.map((environment) => {
            const row = values[environment];
            const rowError = rowErrors?.[environment];
            const notesLabel = `Notes for ${environment}`;
            const setRow = (patch: Partial<typeof row>) => {
              onChange({ ...values, [environment]: { ...row, ...patch } });
            };
            return (
              <div
                key={environment}
                className={cx(
                  'rounded-control border px-3.5 py-3 transition-colors duration-200 motion-reduce:transition-none',
                  row.enabled ? 'border-primary bg-search-bg' : 'border-border-subtle bg-surface',
                )}
              >
                <Checkbox
                  label={environment}
                  checked={row.enabled}
                  disabled={disabled}
                  invalid={Boolean(error)}
                  onChange={(event) => {
                    setRow({ enabled: event.target.checked });
                  }}
                />
                {/* The notes open under the checkbox only for an environment that is in use; the field stays in
                    the document (disabled) so its label is always reachable. */}
                <div
                  className={cx(
                    'grid transition-[grid-template-rows,margin] duration-200 motion-reduce:transition-none',
                    row.enabled ? 'mt-3 grid-rows-[1fr]' : 'mt-0 grid-rows-[0fr]',
                  )}
                >
                  <div className="min-h-0 overflow-hidden">
                    <FormField
                      label={<span className={page ? undefined : 'sr-only'}>{notesLabel}</span>}
                      error={rowError}
                      className="min-w-0"
                    >
                      {(control) =>
                        page ? (
                          <Textarea
                            {...control}
                            rows={2}
                            disabled={disabled || !row.enabled}
                            value={row.notes}
                            onChange={(event) => {
                              setRow({ notes: event.target.value });
                            }}
                          />
                        ) : (
                          <TextField
                            {...control}
                            placeholder="Optional notes"
                            disabled={disabled || !row.enabled}
                            value={row.notes}
                            onChange={(event) => {
                              setRow({ notes: event.target.value });
                            }}
                          />
                        )
                      }
                    </FormField>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </FieldGroup>
  );
}
