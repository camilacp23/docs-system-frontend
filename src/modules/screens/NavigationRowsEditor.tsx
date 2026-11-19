// NavigationRowsEditor: the "Navigates to" card of the Components & navigation tab of the screen edit page (S-21).
// Props: rows (NavigationRow[]), onChange(next rows), errors (by row key), groupError, screens (the options: the screens
// of the application, never the screen being edited), loadingOptions, disabled (while saving).
// One row per navigation: the target screen (chosen with search) and a description. Every control carries the number
// of its row ("Target screen of navigation 2"); its error is linked with aria-describedby. After "Add" the focus goes
// to the new row; after a removal, to the "Add" button.
import { Navigation, Plus, Trash2 } from 'lucide-react';
import { useId, useRef } from 'react';

import {
  Button,
  ICON_STROKE_WIDTH,
  SearchPicker,
  ToneCard,
  TextField,
  type SearchPickerOption,
} from '../../components/ui';

import { CellError } from './CellError';
import { CELL_CLASS, HEAD_CLASS, describedBy, useRowFocus } from './editParts';
import {
  MAX_NAVIGATIONS,
  newNavigationRow,
  type NavigationRow,
  type NavigationRowErrors,
} from './screenEditForm';

interface NavigationRowsEditorProps {
  rows: readonly NavigationRow[];
  onChange: (next: NavigationRow[]) => void;
  errors?: Record<string, NavigationRowErrors>;
  groupError?: string;
  screens: readonly SearchPickerOption[];
  loadingOptions?: boolean;
  disabled?: boolean;
}

export function NavigationRowsEditor({
  rows,
  onChange,
  errors = {},
  groupError,
  screens,
  loadingOptions = false,
  disabled = false,
}: NavigationRowsEditorProps) {
  const baseId = useId();
  const { containerRef, focusRow } = useRowFocus();
  const addRef = useRef<HTMLButtonElement>(null);

  const update = (key: string, patch: Partial<NavigationRow>) => {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  return (
    <ToneCard
      title="Navigates to"
      description="Screens reached from this one"
      icon={<Navigation size={16} strokeWidth={ICON_STROKE_WIDTH} />}
      tone="teal"
      count={rows.length}
      flush
      actions={
        <Button
          ref={addRef}
          size="sm"
          aria-label="Add navigation"
          disabled={disabled || rows.length >= MAX_NAVIGATIONS}
          iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
          onClick={() => {
            const row = newNavigationRow();
            onChange([...rows, row]);
            focusRow(row.key);
          }}
        >
          Add
        </Button>
      }
    >
      <div ref={containerRef}>
        {groupError && <p className="px-5 pb-2 text-small text-danger">{groupError}</p>}
        {rows.length === 0 ? (
          <p className="px-5 py-4 text-body text-ink-500">No navigations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table aria-label="Navigations" className="w-full min-w-150 text-left">
              <thead className="bg-search-bg">
                <tr>
                  <th scope="col" className={HEAD_CLASS}>
                    Target screen <span aria-hidden="true">*</span>
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
                    <tr key={row.key} data-row={row.key} className="border-t border-divider">
                      <td className={CELL_CLASS}>
                        <SearchPicker
                          data-first
                          mono
                          aria-label={`Target screen of navigation ${number}`}
                          aria-required="true"
                          placeholder="Choose a screen"
                          invalid={Boolean(rowErrors.targetScreenId ?? rowErrors.row)}
                          aria-describedby={describedBy(
                            rowErrors.targetScreenId ? `${id}-target` : null,
                            rowErrors.row ? `${id}-row` : null,
                          )}
                          disabled={disabled}
                          loading={loadingOptions}
                          options={screens}
                          value={row.targetScreenId}
                          onChange={(targetScreenId) => {
                            update(row.key, { targetScreenId });
                          }}
                        />
                        <CellError id={`${id}-target`} message={rowErrors.targetScreenId} />
                        <CellError id={`${id}-row`} message={rowErrors.row} />
                      </td>
                      <td className={CELL_CLASS}>
                        <TextField
                          autoComplete="off"
                          aria-label={`Description of navigation ${number}`}
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
                          aria-label={`Remove navigation ${number}`}
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
