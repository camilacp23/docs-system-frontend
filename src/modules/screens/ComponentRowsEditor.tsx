// ComponentRowsEditor: the "Components" card of the Components & navigation tab of the screen edit page (S-21).
// Props: rows (ComponentRow[]), onChange(next rows), errors (by row key), groupError, variables / collections (the
// options of the screen's application, for what a component uses), disabled (while saving).
// One table row per component: name (IBM Plex Mono), type (free text of the Power Apps control), OnSelect (IBM Plex Mono)
// and description. Under each component, its uses: type (variable or collection), the target chosen from the
// application's elements with search, and a description. The frame draws the uses as chips; the contract allows a
// description per use, so each use is a row (pending confirmation in design).
// Every control carries the number of its row ("Name of component 2", "Target of use 1 of component 2"); its error is
// linked with aria-describedby. After "Add" the focus goes to the new row; after a removal, to the "Add" button.
import { Box, Plus, Trash2 } from 'lucide-react';
import { Fragment, useId, useRef } from 'react';

import {
  Button,
  ICON_STROKE_WIDTH,
  SearchPicker,
  ToneCard,
  Select,
  Textarea,
  TextField,
  type SearchPickerOption,
} from '../../components/ui';

import { CellError } from './CellError';
import { CELL_CLASS, HEAD_CLASS, describedBy, useRowFocus } from './editParts';
import {
  MAX_COMPONENTS,
  MAX_USES,
  newComponentRow,
  newUseRow,
  type ComponentRow,
  type ComponentRowErrors,
  type UseRow,
  type UseTargetType,
} from './screenEditForm';

interface ComponentRowsEditorProps {
  rows: readonly ComponentRow[];
  onChange: (next: ComponentRow[]) => void;
  errors?: Record<string, ComponentRowErrors>;
  groupError?: string;
  variables: readonly SearchPickerOption[];
  collections: readonly SearchPickerOption[];
  loadingOptions?: boolean;
  disabled?: boolean;
}

const TARGET_TYPES: ReadonlyArray<{ value: UseTargetType; label: string }> = [
  { value: 'VARIABLE', label: 'Variable' },
  { value: 'COLLECTION', label: 'Collection' },
];

export function ComponentRowsEditor({
  rows,
  onChange,
  errors = {},
  groupError,
  variables,
  collections,
  loadingOptions = false,
  disabled = false,
}: ComponentRowsEditorProps) {
  const baseId = useId();
  const { containerRef, focusRow } = useRowFocus();
  const addRef = useRef<HTMLButtonElement>(null);

  const update = (key: string, patch: Partial<ComponentRow>) => {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };
  const updateUse = (component: ComponentRow, useKey: string, patch: Partial<UseRow>) => {
    update(component.key, {
      uses: component.uses.map((use) => (use.key === useKey ? { ...use, ...patch } : use)),
    });
  };

  const addButton = (
    <Button
      ref={addRef}
      size="sm"
      aria-label="Add component"
      disabled={disabled || rows.length >= MAX_COMPONENTS}
      iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      onClick={() => {
        const row = newComponentRow();
        onChange([...rows, row]);
        focusRow(row.key);
      }}
    >
      Add
    </Button>
  );

  return (
    <ToneCard
      title="Components"
      tone="screen"
      description="Controls of this screen and the variables or collections each one uses"
      icon={<Box size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      count={rows.length}
      actions={addButton}
      flush
    >
      <div ref={containerRef} className="flex flex-col gap-2">
        {groupError && <p className="px-5 text-small text-danger">{groupError}</p>}
        {rows.length === 0 ? (
          <p className="px-5 py-4 text-body text-ink-500">No components yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table aria-label="Components" className="w-full min-w-250 text-left">
              <thead className="bg-search-bg">
                <tr>
                  <th scope="col" className={HEAD_CLASS}>
                    Name <span aria-hidden="true">*</span>
                  </th>
                  <th scope="col" className={HEAD_CLASS}>
                    Type <span aria-hidden="true">*</span>
                  </th>
                  <th scope="col" className={HEAD_CLASS}>
                    OnSelect
                  </th>
                  <th scope="col" className={HEAD_CLASS}>
                    Description
                  </th>
                  <th scope="col" className={HEAD_CLASS}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const number = index + 1;
                  const rowErrors = errors[row.key] ?? {};
                  const id = `${baseId}-${row.key}`;
                  return (
                    <Fragment key={row.key}>
                      <tr data-row={row.key} className="border-t border-divider">
                        <td className={CELL_CLASS}>
                          <TextField
                            data-first
                            mono
                            autoComplete="off"
                            spellCheck={false}
                            aria-label={`Name of component ${number}`}
                            aria-required="true"
                            invalid={Boolean(rowErrors.name ?? rowErrors.row)}
                            aria-describedby={describedBy(
                              rowErrors.name ? `${id}-name` : null,
                              rowErrors.row ? `${id}-row` : null,
                            )}
                            disabled={disabled}
                            value={row.name}
                            onChange={(event) => {
                              update(row.key, { name: event.target.value });
                            }}
                          />
                          <CellError id={`${id}-name`} message={rowErrors.name} />
                          <CellError id={`${id}-row`} message={rowErrors.row} />
                        </td>
                        <td className={CELL_CLASS}>
                          <TextField
                            autoComplete="off"
                            aria-label={`Type of component ${number}`}
                            aria-required="true"
                            invalid={Boolean(rowErrors.type)}
                            aria-describedby={describedBy(rowErrors.type ? `${id}-type` : null)}
                            disabled={disabled}
                            value={row.type}
                            onChange={(event) => {
                              update(row.key, { type: event.target.value });
                            }}
                          />
                          <CellError id={`${id}-type`} message={rowErrors.type} />
                        </td>
                        <td className={CELL_CLASS}>
                          <Textarea
                            rows={2}
                            spellCheck={false}
                            className="font-mono text-label"
                            aria-label={`OnSelect of component ${number}`}
                            invalid={Boolean(rowErrors.onSelect)}
                            aria-describedby={describedBy(
                              rowErrors.onSelect ? `${id}-onselect` : null,
                            )}
                            disabled={disabled}
                            value={row.onSelect}
                            onChange={(event) => {
                              update(row.key, { onSelect: event.target.value });
                            }}
                          />
                          <CellError id={`${id}-onselect`} message={rowErrors.onSelect} />
                        </td>
                        <td className={CELL_CLASS}>
                          <Textarea
                            rows={2}
                            aria-label={`Description of component ${number}`}
                            invalid={Boolean(rowErrors.description)}
                            aria-describedby={describedBy(
                              rowErrors.description ? `${id}-description` : null,
                            )}
                            disabled={disabled}
                            value={row.description}
                            onChange={(event) => {
                              update(row.key, { description: event.target.value });
                            }}
                          />
                          <CellError id={`${id}-description`} message={rowErrors.description} />
                        </td>
                        <td className={`${CELL_CLASS} whitespace-nowrap`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove component ${number}`}
                            disabled={disabled}
                            onClick={() => {
                              onChange(rows.filter((candidate) => candidate.key !== row.key));
                              addRef.current?.focus();
                            }}
                          >
                            <Trash2 aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
                          </Button>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={5} className="px-2 pt-0 pb-3">
                          <UsesList
                            component={row}
                            number={number}
                            errors={rowErrors}
                            variables={variables}
                            collections={collections}
                            loadingOptions={loadingOptions}
                            disabled={disabled}
                            onUpdate={(useKey, patch) => {
                              updateUse(row, useKey, patch);
                            }}
                            onUses={(uses, focusKey) => {
                              update(row.key, { uses });
                              if (focusKey !== undefined) focusRow(focusKey);
                            }}
                          />
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ToneCard>
  );
}

interface UsesListProps {
  component: ComponentRow;
  number: number;
  errors: ComponentRowErrors;
  variables: readonly SearchPickerOption[];
  collections: readonly SearchPickerOption[];
  loadingOptions: boolean;
  disabled: boolean;
  onUpdate: (useKey: string, patch: Partial<UseRow>) => void;
  onUses: (uses: UseRow[], focusKey?: string) => void;
}

function UsesList({
  component,
  number,
  errors,
  variables,
  collections,
  loadingOptions,
  disabled,
  onUpdate,
  onUses,
}: UsesListProps) {
  const baseId = useId();
  const addUseRef = useRef<HTMLButtonElement>(null);
  return (
    <section
      aria-label={`Uses of component ${number}`}
      className="ml-3 flex flex-col gap-2 border-l-2 border-divider pl-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-small font-semibold text-ink-700">
          Uses{' '}
          <span className="font-normal text-ink-500">
            · variables or collections this component uses
          </span>
        </h3>
        <Button
          ref={addUseRef}
          size="sm"
          variant="ghost"
          disabled={disabled || component.uses.length >= MAX_USES}
          iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
          onClick={() => {
            const use = newUseRow();
            onUses([...component.uses, use], use.key);
          }}
        >
          <span aria-hidden="true">Add use</span>
          <span className="sr-only">{`Add use to component ${number}`}</span>
        </Button>
      </div>
      {errors.uses && <p className="text-small text-danger">{errors.uses}</p>}
      {component.uses.map((use, useIndex) => {
        const label = `use ${useIndex + 1} of component ${number}`;
        const useErrors = errors.useRows?.[use.key] ?? {};
        const id = `${baseId}-${use.key}`;
        const options = use.targetType === 'COLLECTION' ? collections : variables;
        return (
          <div
            key={use.key}
            data-row={use.key}
            role="group"
            aria-label={`Use ${useIndex + 1} of component ${number}`}
            className="grid grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.4fr)_auto] items-start gap-2"
          >
            <div>
              <Select
                data-first
                aria-label={`Type of ${label}`}
                aria-required="true"
                invalid={Boolean(useErrors.targetType)}
                aria-describedby={describedBy(useErrors.targetType ? `${id}-type` : null)}
                disabled={disabled}
                value={use.targetType}
                onChange={(event) => {
                  // The target belongs to the type: a new type starts without target.
                  onUpdate(use.key, {
                    targetType: event.target.value as UseTargetType | '',
                    targetId: '',
                  });
                }}
              >
                {TARGET_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
              <CellError id={`${id}-type`} message={useErrors.targetType} />
            </div>
            <div>
              <SearchPicker
                mono
                aria-label={`Target of ${label}`}
                aria-required="true"
                placeholder={
                  use.targetType === 'COLLECTION' ? 'Choose a collection' : 'Choose a variable'
                }
                invalid={Boolean(useErrors.targetId ?? useErrors.row)}
                aria-describedby={describedBy(
                  useErrors.targetId ? `${id}-target` : null,
                  useErrors.row ? `${id}-row` : null,
                )}
                disabled={disabled}
                loading={loadingOptions}
                options={options}
                value={use.targetId}
                onChange={(targetId) => {
                  onUpdate(use.key, { targetId });
                }}
              />
              <CellError id={`${id}-target`} message={useErrors.targetId} />
              <CellError id={`${id}-row`} message={useErrors.row} />
            </div>
            <div>
              <TextField
                autoComplete="off"
                aria-label={`Description of ${label}`}
                placeholder="Description"
                invalid={Boolean(useErrors.description)}
                aria-describedby={describedBy(useErrors.description ? `${id}-description` : null)}
                disabled={disabled}
                value={use.description}
                onChange={(event) => {
                  onUpdate(use.key, { description: event.target.value });
                }}
              />
              <CellError id={`${id}-description`} message={useErrors.description} />
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${label}`}
              disabled={disabled}
              onClick={() => {
                onUses(component.uses.filter((candidate) => candidate.key !== use.key));
                addUseRef.current?.focus();
              }}
            >
              <Trash2 aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
            </Button>
          </div>
        );
      })}
    </section>
  );
}
