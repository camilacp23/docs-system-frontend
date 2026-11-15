// AssignmentRowsEditor: the "Variable assignments" table of the collection edit page (S-16): how this collection
// feeds variables (FR-09). Props: rows (AssignmentRow[]), onChange(next rows), errors (by row key), groupError,
// variables (the variables of the application: { id, name, scope? }), screens (its screens), disabled (while saving).
// Each row: variable, function (Set / UpdateContext), table function (optional), screen and used in (the exact Power
// Apps event or property). Choosing a variable SUGGESTS the function that fits its scope (Set for global,
// UpdateContext for context) when the function was not chosen by hand; nothing is blocked: the server decides and its
// 422 (CROSS_APPLICATION, SCOPE_MISMATCH, CONTEXT_SCREEN_MISMATCH) is shown on the row it points to.
// Every control carries the number of its row in its label ("Variable (assignment 2)") and its error is linked with
// aria-describedby.
import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';

import { Button, ICON_STROKE_WIDTH, Select, TextField } from '../../components/ui';
import { APP_SCREEN_LABEL, ASSIGNMENT_FUNCTION_LABEL } from '../variables/variableLabels';
import type { AssignmentFunction, VariableScope } from '../variables/variableTypes';

import {
  MAX_ASSIGNMENTS,
  newAssignmentRow,
  suggestedFunction,
  type AssignmentRow,
  type AssignmentRowErrors,
} from './collectionForm';

export interface VariableOption {
  id: number;
  name: string;
  scope?: VariableScope;
}

export interface ScreenOption {
  id: number;
  name: string;
  isAppContext?: boolean;
}

interface AssignmentRowsEditorProps {
  rows: readonly AssignmentRow[];
  onChange: (next: AssignmentRow[]) => void;
  errors?: Record<string, AssignmentRowErrors>;
  groupError?: string;
  variables: readonly VariableOption[];
  screens: readonly ScreenOption[];
  disabled?: boolean;
}

const FUNCTIONS: readonly AssignmentFunction[] = ['SET', 'UPDATE_CONTEXT'];
const HEAD_CLASS = 'px-2 py-2 text-left text-micro font-bold tracking-wider text-ink-500 uppercase';
const CELL_CLASS = 'px-2 py-2 align-top';

function CellError({ id, message }: { id: string; message: string | undefined }) {
  return message ? (
    <p id={id} className="mt-1 text-small text-danger">
      {message}
    </p>
  ) : null;
}

const describedBy = (...ids: Array<string | null>) => ids.filter(Boolean).join(' ') || undefined;

export function AssignmentRowsEditor({
  rows,
  onChange,
  errors = {},
  groupError,
  variables,
  screens,
  disabled = false,
}: AssignmentRowsEditorProps) {
  const baseId = useId();

  const update = (key: string, patch: Partial<AssignmentRow>) => {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const chooseVariable = (row: AssignmentRow, variableId: string) => {
    const scopeOf = (id: string) => variables.find((v) => String(v.id) === id)?.scope;
    const before = scopeOf(row.variableId);
    const after = scopeOf(variableId);
    // The suggestion replaces an empty function or the one that was suggested for the previous variable.
    const following =
      row.assignmentFunction === '' ||
      (before && row.assignmentFunction === suggestedFunction(before));
    update(row.key, {
      variableId,
      ...(after !== undefined && following && { assignmentFunction: suggestedFunction(after) }),
    });
  };

  return (
    <section aria-label="Variable assignments" className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="text-label font-medium text-ink-700">Variable assignments</h3>
          <span className="text-small text-ink-500">
            Which variables this collection feeds, where and how
          </span>
        </div>
        <Button
          size="sm"
          disabled={disabled || rows.length >= MAX_ASSIGNMENTS}
          iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
          onClick={() => {
            onChange([...rows, newAssignmentRow()]);
          }}
        >
          Add assignment
        </Button>
      </div>
      {groupError && <p className="text-small text-danger">{groupError}</p>}
      {rows.length === 0 ? (
        <p className="rounded-control border border-dashed border-border-subtle px-3 py-4 text-body text-ink-500">
          No variable assignments yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-control border border-border-subtle">
          <table aria-label="Variable assignments" className="w-full min-w-215 text-left">
            <thead className="bg-search-bg">
              <tr>
                {['Variable *', 'Function *', 'Table function', 'Screen *', 'Used in *'].map(
                  (header) => (
                    <th key={header} scope="col" className={HEAD_CLASS}>
                      {header.endsWith('*') ? (
                        <>
                          {header.slice(0, -2)} <span aria-hidden="true">*</span>
                        </>
                      ) : (
                        header
                      )}
                    </th>
                  ),
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
                    <td className={CELL_CLASS}>
                      <Select
                        mono
                        aria-label={`Variable (assignment ${number})`}
                        aria-required="true"
                        invalid={Boolean(rowErrors.variableId ?? rowErrors.row)}
                        aria-describedby={describedBy(
                          rowErrors.variableId ? `${id}-variable` : null,
                          rowErrors.row ? `${id}-row` : null,
                        )}
                        disabled={disabled}
                        value={row.variableId}
                        onChange={(event) => {
                          chooseVariable(row, event.target.value);
                        }}
                      >
                        <option value="">Choose a variable</option>
                        {variables.map((variable) => (
                          <option key={variable.id} value={variable.id}>
                            {variable.name}
                          </option>
                        ))}
                      </Select>
                      <CellError id={`${id}-variable`} message={rowErrors.variableId} />
                      <CellError id={`${id}-row`} message={rowErrors.row} />
                    </td>
                    <td className={CELL_CLASS}>
                      <Select
                        aria-label={`Function (assignment ${number})`}
                        aria-required="true"
                        invalid={Boolean(rowErrors.assignmentFunction)}
                        aria-describedby={describedBy(
                          rowErrors.assignmentFunction ? `${id}-function` : null,
                        )}
                        disabled={disabled}
                        value={row.assignmentFunction}
                        onChange={(event) => {
                          update(row.key, {
                            assignmentFunction: event.target.value as AssignmentFunction | '',
                          });
                        }}
                      >
                        <option value="">Choose a function</option>
                        {FUNCTIONS.map((value) => (
                          <option key={value} value={value}>
                            {ASSIGNMENT_FUNCTION_LABEL[value]}
                          </option>
                        ))}
                      </Select>
                      <CellError id={`${id}-function`} message={rowErrors.assignmentFunction} />
                    </td>
                    <td className={CELL_CLASS}>
                      <TextField
                        mono
                        autoComplete="off"
                        spellCheck={false}
                        aria-label={`Table function (assignment ${number})`}
                        invalid={Boolean(rowErrors.tableFunction)}
                        aria-describedby={describedBy(
                          rowErrors.tableFunction ? `${id}-table` : null,
                        )}
                        disabled={disabled}
                        value={row.tableFunction}
                        onChange={(event) => {
                          update(row.key, { tableFunction: event.target.value });
                        }}
                      />
                      <CellError id={`${id}-table`} message={rowErrors.tableFunction} />
                    </td>
                    <td className={CELL_CLASS}>
                      <Select
                        mono
                        aria-label={`Screen (assignment ${number})`}
                        aria-required="true"
                        invalid={Boolean(rowErrors.screenId)}
                        aria-describedby={describedBy(rowErrors.screenId ? `${id}-screen` : null)}
                        disabled={disabled}
                        value={row.screenId}
                        onChange={(event) => {
                          update(row.key, { screenId: event.target.value });
                        }}
                      >
                        <option value="">Choose a screen</option>
                        {screens.map((screen) => (
                          <option key={screen.id} value={screen.id}>
                            {screen.isAppContext ? APP_SCREEN_LABEL : screen.name}
                          </option>
                        ))}
                      </Select>
                      <CellError id={`${id}-screen`} message={rowErrors.screenId} />
                    </td>
                    <td className={CELL_CLASS}>
                      <TextField
                        mono
                        autoComplete="off"
                        spellCheck={false}
                        aria-label={`Used in (assignment ${number})`}
                        aria-required="true"
                        invalid={Boolean(rowErrors.usedIn)}
                        aria-describedby={describedBy(rowErrors.usedIn ? `${id}-used` : null)}
                        disabled={disabled}
                        value={row.usedIn}
                        onChange={(event) => {
                          update(row.key, { usedIn: event.target.value });
                        }}
                      />
                      <CellError id={`${id}-used`} message={rowErrors.usedIn} />
                    </td>
                    <td className={`${CELL_CLASS} whitespace-nowrap`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove assignment ${number}`}
                        disabled={disabled}
                        onClick={() => {
                          onChange(rows.filter((candidate) => candidate.key !== row.key));
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
    </section>
  );
}
