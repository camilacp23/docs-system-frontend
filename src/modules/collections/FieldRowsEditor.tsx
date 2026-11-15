// FieldRowsEditor: the "Fields" table of a collection form, shared by the creation modal (S-14n, layout 'modal':
// name and data type) and the edit page (S-16, layout 'page': also the description and the order buttons).
// Props: layout, rows (FieldRow[]), onChange(next rows), errors (by row key), groupError (the Fields group),
// disabled (while saving).
// The order of the rows IS the order of the fields: `position` is computed from it when the form is sent. Rows are
// reordered with "Move field N up / down" buttons (native buttons, so the keyboard works; the first row cannot go up
// and the last cannot go down). After a move the focus stays on the button that moved the row, and a polite live
// region says the new position. Every control carries the number of its row in its label.
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button, ICON_STROKE_WIDTH, Select, TextField } from '../../components/ui';
import { DATA_TYPES, DATA_TYPE_LABEL } from '../variables/variableLabels';
import type { DataType } from '../variables/variableTypes';

import {
  MAX_FIELDS,
  moveRow,
  newFieldRow,
  type FieldRow,
  type FieldRowErrors,
} from './collectionForm';

interface FieldRowsEditorProps {
  layout: 'modal' | 'page';
  rows: readonly FieldRow[];
  onChange: (next: FieldRow[]) => void;
  errors?: Record<string, FieldRowErrors>;
  groupError?: string;
  disabled?: boolean;
}

const HEAD_CLASS = 'px-2 py-2 text-left text-micro font-bold tracking-wider text-ink-500 uppercase';
const CELL_CLASS = 'px-2 py-2 align-top';

function CellError({ id, message }: { id: string; message: string | undefined }) {
  return message ? (
    <p id={id} className="mt-1 text-small text-danger">
      {message}
    </p>
  ) : null;
}

export function FieldRowsEditor({
  layout,
  rows,
  onChange,
  errors = {},
  groupError,
  disabled = false,
}: FieldRowsEditorProps) {
  const page = layout === 'page';
  const baseId = useId();
  const container = useRef<HTMLDivElement>(null);
  const [moved, setMoved] = useState<{ key: string; direction: 'up' | 'down' } | null>(null);
  const [announcement, setAnnouncement] = useState('');

  // After a move the browser may drop the focus (the row's DOM node was moved): put it back on the same button, or
  // on its twin when the row reached the edge and that button is now disabled.
  useEffect(() => {
    if (moved === null) return;
    const pick = (direction: string) =>
      container.current?.querySelector<HTMLButtonElement>(
        `[data-move="${moved.key}:${direction}"]`,
      );
    const wanted = pick(moved.direction);
    const target =
      wanted?.disabled === false ? wanted : pick(moved.direction === 'up' ? 'down' : 'up');
    target?.focus();
  }, [moved, rows]);

  const update = (key: string, patch: Partial<FieldRow>) => {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const move = (index: number, delta: -1 | 1) => {
    const row = rows[index];
    if (row === undefined) return;
    onChange(moveRow(rows, index, delta));
    setMoved({ key: row.key, direction: delta === -1 ? 'up' : 'down' });
    setAnnouncement(
      `Field ${row.name === '' ? index + 1 : row.name} moved to position ${index + 1 + delta} of ${rows.length}.`,
    );
  };

  const hint = page ? 'Order = row order; use the arrows to reorder' : 'Order = row order';
  return (
    <section ref={container} aria-label="Fields" className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="text-label font-medium text-ink-700">Fields</h3>
          <span className="text-small text-ink-500">{hint}</span>
        </div>
        <Button
          size="sm"
          disabled={disabled || rows.length >= MAX_FIELDS}
          iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
          onClick={() => {
            onChange([...rows, newFieldRow()]);
          }}
        >
          Add field
        </Button>
      </div>
      {groupError && <p className="text-small text-danger">{groupError}</p>}
      {rows.length === 0 ? (
        <p className="rounded-control border border-dashed border-border-subtle px-3 py-4 text-body text-ink-500">
          No fields yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-control border border-border-subtle">
          <table aria-label="Fields" className="w-full text-left">
            <thead className="bg-search-bg">
              <tr>
                <th scope="col" className={HEAD_CLASS}>
                  #
                </th>
                <th scope="col" className={HEAD_CLASS}>
                  Name <span aria-hidden="true">*</span>
                </th>
                <th scope="col" className={HEAD_CLASS}>
                  Data type <span aria-hidden="true">*</span>
                </th>
                {page && (
                  <th scope="col" className={HEAD_CLASS}>
                    Description
                  </th>
                )}
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
                  <tr key={row.key} className="border-t border-divider">
                    <td className={`${CELL_CLASS} pt-4 text-label text-ink-500`}>{number}</td>
                    <td className={CELL_CLASS}>
                      <TextField
                        mono
                        autoComplete="off"
                        spellCheck={false}
                        aria-label={`Name of field ${number}`}
                        aria-required="true"
                        invalid={Boolean(rowErrors.name ?? rowErrors.row)}
                        aria-describedby={
                          [rowErrors.name ? `${id}-name` : null, rowErrors.row ? `${id}-row` : null]
                            .filter(Boolean)
                            .join(' ') || undefined
                        }
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
                      <Select
                        aria-label={`Data type of field ${number}`}
                        aria-required="true"
                        invalid={Boolean(rowErrors.dataType)}
                        aria-describedby={rowErrors.dataType ? `${id}-type` : undefined}
                        disabled={disabled}
                        value={row.dataType}
                        onChange={(event) => {
                          update(row.key, { dataType: event.target.value as DataType | '' });
                        }}
                      >
                        {row.dataType === '' && <option value="">Choose a data type</option>}
                        {DATA_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {DATA_TYPE_LABEL[type]}
                          </option>
                        ))}
                      </Select>
                      <CellError id={`${id}-type`} message={rowErrors.dataType} />
                    </td>
                    {page && (
                      <td className={CELL_CLASS}>
                        <TextField
                          aria-label={`Description of field ${number}`}
                          invalid={Boolean(rowErrors.description)}
                          aria-describedby={rowErrors.description ? `${id}-description` : undefined}
                          disabled={disabled}
                          value={row.description}
                          onChange={(event) => {
                            update(row.key, { description: event.target.value });
                          }}
                        />
                        <CellError id={`${id}-description`} message={rowErrors.description} />
                      </td>
                    )}
                    <td className={`${CELL_CLASS} whitespace-nowrap`}>
                      <span className="inline-flex items-center gap-1">
                        {page && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              data-move={`${row.key}:up`}
                              aria-label={`Move field ${number} up`}
                              disabled={disabled || index === 0}
                              onClick={() => {
                                move(index, -1);
                              }}
                            >
                              <ChevronUp
                                aria-hidden="true"
                                size={16}
                                strokeWidth={ICON_STROKE_WIDTH}
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              data-move={`${row.key}:down`}
                              aria-label={`Move field ${number} down`}
                              disabled={disabled || index === rows.length - 1}
                              onClick={() => {
                                move(index, 1);
                              }}
                            >
                              <ChevronDown
                                aria-hidden="true"
                                size={16}
                                strokeWidth={ICON_STROKE_WIDTH}
                              />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove field ${number}`}
                          disabled={disabled}
                          onClick={() => {
                            onChange(rows.filter((candidate) => candidate.key !== row.key));
                          }}
                        >
                          <Trash2 aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />
                        </Button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
