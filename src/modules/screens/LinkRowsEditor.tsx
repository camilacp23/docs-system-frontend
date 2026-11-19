// LinkRowsEditor: the "Variables" and "Collections" cards of the Variables & collections tab of the screen edit page
// (S-22). Props: kind ('variable' | 'collection'), rows, onChange(next rows), errors (by row key), groupError, options (the
// elements of the screen's application, for the search picker), accessOf (variables only: what the access mode may be for
// the chosen variable), origins (variables only: the rows the variables module keeps), loadingOptions, disabled.
// One row per link: the element (chosen with search), the access mode (radios: Read, Write, Read/Write, centered in its
// column) and where in the
// screen it happens (`usedIn`, IBM Plex Mono: "OnVisible", "btnGuardar.OnSelect"). A context variable of another screen
// can only be written (Navigate), so Read and Read/Write are disabled for it with the reason of the frame; choosing such
// a variable switches the row to Write. The API judges it too and its answer is shown on the row.
// The origin rows come first: the variable is created in this screen (the "Origin" tag and the Write mode stay, read only), and its
// "Used in" (`originUsedIn`, optional) is editable here but saved on the VARIABLE (PUT /variables/{id}); the row is never sent in the
// PUT of the screen.
// Every control carries the number of its row ("Variable (link 2)"); its error is linked with aria-describedby. After
// "Add" the focus goes to the new row; after a removal, to the "Add" button.
import { Database, Lock, Plus, Trash2, Variable } from 'lucide-react';
import { useId, useRef } from 'react';
import { Link } from 'react-router';

import {
  Button,
  ICON_STROKE_WIDTH,
  SearchPicker,
  ToneCard,
  SegmentedControl,
  Tag,
  TextField,
  type SearchPickerOption,
} from '../../components/ui';

import { CellError } from './CellError';
import { CELL_CLASS, HEAD_CLASS, describedBy, useRowFocus } from './editParts';
import { WRITE_ONLY_REASON, type VariableAccess } from './editOptions';
import {
  ACCESS_MODE_LABEL,
  ACCESS_MODES,
  MAX_COLLECTION_LINKS,
  MAX_VARIABLE_LINKS,
  newCollectionLinkRow,
  newVariableLinkRow,
  type CollectionLinkRow,
  type OriginLink,
  type VariableLinkRow,
} from './screenEditForm';
import { ORIGIN_ROW_NOTE } from './ScreenLinksTab';

export type LinkRow = VariableLinkRow | CollectionLinkRow;

/** The errors of a link row with the element error under one name (`variableId` / `collectionId` of the form). */
export interface LinkRowErrors {
  element?: string;
  accessMode?: string;
  usedIn?: string;
  row?: string;
}

interface LinkRowsEditorProps {
  kind: 'variable' | 'collection';
  rows: readonly LinkRow[];
  onChange: (next: LinkRow[]) => void;
  errors?: Record<string, LinkRowErrors>;
  groupError?: string;
  options: readonly SearchPickerOption[];
  accessOf?: (elementId: string) => VariableAccess;
  origins?: readonly OriginLink[];
  /** The user typed in the "Used in" of an origin row (saved on the variable, not with the screen). */
  onOriginChange?: (id: number, usedIn: string) => void;
  /** Errors of the "Used in" of the origin rows, by the id of the link. */
  originErrors?: Record<number, string>;
  loadingOptions?: boolean;
  disabled?: boolean;
}

const elementOf = (row: LinkRow): string =>
  'variableId' in row ? row.variableId : row.collectionId;
const withElement = (row: LinkRow, value: string): LinkRow =>
  'variableId' in row ? { ...row, variableId: value } : { ...row, collectionId: value };

const COPY = {
  variable: {
    title: 'Variables',
    description: 'Access mode and where in this screen it happens',
    noun: 'variable',
    placeholder: 'Choose a variable',
    add: 'Add variable',
    empty: 'No variables linked yet.',
    tableLabel: 'Variable links',
    column: 'Variable',
  },
  collection: {
    title: 'Collections',
    description: 'Collections this screen reads or writes',
    noun: 'collection',
    placeholder: 'Choose a collection',
    add: 'Add collection',
    empty: 'No collections linked yet.',
    tableLabel: 'Collection links',
    column: 'Collection',
  },
} as const;

export function LinkRowsEditor({
  kind,
  rows,
  onChange,
  errors = {},
  groupError,
  options,
  accessOf,
  origins = [],
  onOriginChange,
  originErrors = {},
  loadingOptions = false,
  disabled = false,
}: LinkRowsEditorProps) {
  const copy = COPY[kind];
  const baseId = useId();
  const { containerRef, focusRow } = useRowFocus();
  const addRef = useRef<HTMLButtonElement>(null);
  const max = kind === 'variable' ? MAX_VARIABLE_LINKS : MAX_COLLECTION_LINKS;

  const update = (key: string, patch: Partial<LinkRow>) => {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const choose = (row: LinkRow, elementId: string) => {
    const changed = withElement(row, elementId);
    // A variable that can only be written switches the row to Write.
    const forced = accessOf?.(elementId) === 'write-only' && row.accessMode !== 'WRITE';
    onChange(
      rows.map((candidate) =>
        candidate.key === row.key
          ? forced
            ? { ...changed, accessMode: 'WRITE' }
            : changed
          : candidate,
      ),
    );
  };

  const showTable = rows.length > 0 || origins.length > 0;

  return (
    <ToneCard
      title={copy.title}
      description={copy.description}
      icon={
        kind === 'variable' ? (
          <Variable size={16} strokeWidth={ICON_STROKE_WIDTH} />
        ) : (
          <Database size={16} strokeWidth={ICON_STROKE_WIDTH} />
        )
      }
      tone={kind === 'variable' ? 'variable' : 'collection'}
      count={rows.length + origins.length}
      flush
      actions={
        <Button
          ref={addRef}
          size="sm"
          aria-label={copy.add}
          disabled={disabled || rows.length >= max}
          iconLeft={<Plus aria-hidden="true" size={16} strokeWidth={ICON_STROKE_WIDTH} />}
          onClick={() => {
            const row = kind === 'variable' ? newVariableLinkRow() : newCollectionLinkRow();
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
        {!showTable ? (
          <p className="px-5 py-4 text-body text-ink-500">{copy.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table aria-label={copy.tableLabel} className="w-full min-w-200 text-left">
              <thead className="bg-search-bg">
                <tr>
                  <th scope="col" className={HEAD_CLASS}>
                    {copy.column} <span aria-hidden="true">*</span>
                  </th>
                  <th scope="col" className={HEAD_CLASS.replace('text-left', 'text-center')}>
                    Access <span aria-hidden="true">*</span>
                  </th>
                  <th scope="col" className={HEAD_CLASS}>
                    Used in <span aria-hidden="true">*</span>
                  </th>
                  <th scope="col" className={HEAD_CLASS}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {origins.map((origin) => (
                  <tr key={origin.id} className="border-t border-divider bg-search-bg">
                    <td className={CELL_CLASS}>
                      <Link
                        to={`/variables/${origin.variable.id}`}
                        className="rounded-chip font-mono text-label font-semibold text-identifier hover:underline"
                      >
                        {origin.variable.name}
                      </Link>{' '}
                      <Tag tone="info">Origin</Tag>
                    </td>
                    <td className={`${CELL_CLASS} text-center`}>
                      <Tag>{ACCESS_MODE_LABEL[origin.accessMode]}</Tag>
                    </td>
                    <td className={CELL_CLASS}>
                      <TextField
                        mono
                        autoComplete="off"
                        spellCheck={false}
                        aria-label={`Used in (origin ${origin.variable.name})`}
                        placeholder="OnVisible"
                        invalid={Boolean(originErrors[origin.id])}
                        aria-describedby={describedBy(
                          originErrors[origin.id] ? `${baseId}-origin-${origin.id}` : null,
                        )}
                        disabled={disabled}
                        value={origin.originUsedIn}
                        onChange={(event) => {
                          onOriginChange?.(origin.id, event.target.value);
                        }}
                      />
                      <CellError
                        id={`${baseId}-origin-${origin.id}`}
                        message={originErrors[origin.id]}
                      />
                    </td>
                    <td className={`${CELL_CLASS} text-small text-ink-500`}>
                      <span className="flex items-center gap-1.5">
                        <Lock aria-hidden="true" size={14} strokeWidth={ICON_STROKE_WIDTH} />
                        Saved on the variable
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.map((row, index) => {
                  const number = index + 1;
                  const label = `link ${number}`;
                  const rowErrors = errors[row.key] ?? {};
                  const id = `${baseId}-${row.key}`;
                  const elementId = elementOf(row);
                  const writeOnly = accessOf?.(elementId) === 'write-only';
                  return (
                    <tr key={row.key} data-row={row.key} className="border-t border-divider">
                      <td className={CELL_CLASS}>
                        <SearchPicker
                          data-first
                          mono
                          aria-label={`${copy.column} (${label})`}
                          aria-required="true"
                          placeholder={copy.placeholder}
                          invalid={Boolean(rowErrors.element ?? rowErrors.row)}
                          aria-describedby={describedBy(
                            rowErrors.element ? `${id}-element` : null,
                            rowErrors.row ? `${id}-row` : null,
                          )}
                          disabled={disabled}
                          loading={loadingOptions}
                          options={options}
                          value={elementId}
                          onChange={(value) => {
                            choose(row, value);
                          }}
                        />
                        <CellError id={`${id}-element`} message={rowErrors.element} />
                        <CellError id={`${id}-row`} message={rowErrors.row} />
                      </td>
                      <td className={`${CELL_CLASS} text-center`}>
                        <SegmentedControl
                          name={`${id}-access`}
                          label={`Access (${copy.noun} ${label})`}
                          invalid={Boolean(rowErrors.accessMode)}
                          aria-describedby={describedBy(
                            writeOnly ? `${id}-write-only` : null,
                            rowErrors.accessMode ? `${id}-access` : null,
                          )}
                          disabled={disabled}
                          options={ACCESS_MODES.map((mode) => ({
                            value: mode,
                            label: ACCESS_MODE_LABEL[mode],
                            disabled: writeOnly && mode !== 'WRITE',
                            title: writeOnly && mode !== 'WRITE' ? WRITE_ONLY_REASON : undefined,
                          }))}
                          value={row.accessMode}
                          className="mx-auto"
                          onChange={(accessMode) => {
                            update(row.key, { accessMode });
                          }}
                        />
                        {writeOnly && (
                          <p id={`${id}-write-only`} className="mt-1 text-small text-ink-500">
                            {WRITE_ONLY_REASON}
                          </p>
                        )}
                        <CellError id={`${id}-access`} message={rowErrors.accessMode} />
                      </td>
                      <td className={CELL_CLASS}>
                        <TextField
                          mono
                          autoComplete="off"
                          spellCheck={false}
                          aria-label={`Used in (${copy.noun} ${label})`}
                          aria-required="true"
                          placeholder="OnVisible"
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
                          aria-label={`Remove ${copy.noun} ${label}`}
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
        {origins.length > 0 && (
          <p className="border-t border-divider px-5 py-3 text-small text-ink-500">
            {ORIGIN_ROW_NOTE}
          </p>
        )}
      </div>
    </ToneCard>
  );
}
