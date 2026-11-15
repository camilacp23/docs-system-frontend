// collectionForm: the form model of a collection, shared by the creation modal (S-14n) and the edit page (S-16).
//   emptyCollectionValues(), valuesFromCollection(collection)  -> the initial form values
//   toCollectionWrite(values)      -> the COMPLETE body the API expects (POST and PUT): the three arrays `fields`,
//                                     `variableAssignments` and `derivedFrom` are ALWAYS present, even empty, because
//                                     an omitted array deletes what exists (PUT /collections/{id}, contract 0.3.3).
//   submittedRows(values)          -> the row keys in the order they were sent, to put a server error (which only
//                                     knows a position, `fields[3].name`) on the row that was at that position
//   validateCollection(values)     -> the errors of the rules the CONTRACT declares; every other rule is the server's
//   moveRow(rows, index, delta)    -> the rows with one moved up (-1) or down (+1)
// Rows: an existing item keeps its server `id` (reconciliation by id, D-26); a new row has none and is sent without
// one. `key` is local to the browser (the React key and the key of the errors): it never travels to the server and
// is never a temporary id.
import { getRuleMessage } from '../../api/messages';
import {
  emptyEnvironments,
  environmentsFromDetails,
  environmentsToWrite,
  validateEnvironments,
  type EnvironmentErrors,
  type EnvironmentValues,
} from '../shared/environmentForm';
import type {
  AssignmentFunction,
  DataType,
  Environment,
  VariableScope,
} from '../variables/variableTypes';

import type {
  Collection,
  CollectionFieldWrite,
  CollectionWrite,
  VariableAssignmentWrite,
} from './collectionTypes';

/** Limits and patterns of CollectionWrite in the contract. */
export const NAME_MAX_LENGTH = 150;
export const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const TEXT_MAX_LENGTH = 4000;
export const FIELD_DESCRIPTION_MAX_LENGTH = 2000;
export const TABLE_FUNCTION_MAX_LENGTH = 200;
export const USED_IN_MAX_LENGTH = 200;
export const USED_IN_PATTERN = /^(?!origin$)[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;
export const MAX_FIELDS = 200;
export const MAX_ASSIGNMENTS = 200;
export const MAX_DERIVED_FROM = 50;

export const FIELD_LABEL = {
  name: 'Name',
  description: 'Description',
  creationCondition: 'Creation condition',
  fields: 'Fields',
  fieldName: 'Name',
  fieldDataType: 'Data type',
  fieldDescription: 'Description',
  assignments: 'Variable assignments',
  variable: 'Variable',
  screen: 'Screen',
  assignmentFunction: 'Function',
  tableFunction: 'Table function',
  usedIn: 'Used in',
  derivedFrom: 'Derived from',
} as const;

export interface FieldRow {
  /** Local key (React and errors); never sent. */
  key: string;
  /** The id of an existing field; absent on a new row. */
  id?: number;
  name: string;
  dataType: DataType | '';
  description: string;
}

export interface AssignmentRow {
  key: string;
  id?: number;
  /** Ids as text, '' = not chosen yet. */
  variableId: string;
  screenId: string;
  assignmentFunction: AssignmentFunction | '';
  tableFunction: string;
  usedIn: string;
}

export interface CollectionFormValues {
  name: string;
  description: string;
  creationCondition: string;
  environments: EnvironmentValues;
  fields: FieldRow[];
  assignments: AssignmentRow[];
  derivedFrom: number[];
}

let rowCounter = 0;
/** A key for a row that exists only in the browser. */
export function newRowKey(): string {
  rowCounter += 1;
  return `new-${rowCounter}`;
}

export function newFieldRow(): FieldRow {
  return { key: newRowKey(), name: '', dataType: 'TEXT', description: '' };
}

export function newAssignmentRow(): AssignmentRow {
  return {
    key: newRowKey(),
    variableId: '',
    screenId: '',
    assignmentFunction: '',
    tableFunction: '',
    usedIn: '',
  };
}

/** The function that fits the scope of a variable (SCOPE_MISMATCH): a suggestion, the server decides. */
export function suggestedFunction(scope: VariableScope): AssignmentFunction {
  return scope === 'GLOBAL' ? 'SET' : 'UPDATE_CONTEXT';
}

export function emptyCollectionValues(): CollectionFormValues {
  return {
    name: '',
    description: '',
    creationCondition: '',
    environments: emptyEnvironments(),
    fields: [],
    assignments: [],
    derivedFrom: [],
  };
}

export function valuesFromCollection(
  collection: Collection,
  fields: Collection['fields'] = collection.fields,
): CollectionFormValues {
  return {
    name: collection.name,
    description: collection.description ?? '',
    creationCondition: collection.creationCondition ?? '',
    environments: environmentsFromDetails(collection.environmentDetails),
    fields: [...fields]
      .sort((a, b) => a.position - b.position || a.id - b.id)
      .map((field) => ({
        key: `field-${field.id}`,
        id: field.id,
        name: field.name,
        dataType: field.dataType,
        description: field.description ?? '',
      })),
    assignments: collection.variableAssignments.map((assignment) => ({
      key: `assignment-${assignment.id}`,
      id: assignment.id,
      variableId: String(assignment.variable.id),
      screenId: String(assignment.screen.id),
      assignmentFunction: assignment.assignmentFunction,
      tableFunction: assignment.tableFunction ?? '',
      usedIn: assignment.usedIn,
    })),
    derivedFrom: collection.derivedFrom.map((ref) => ref.id),
  };
}

const orNull = (text: string): string | null => (text === '' ? null : text);

function fieldWrite(row: FieldRow, position: number): CollectionFieldWrite {
  return {
    ...(row.id !== undefined && { id: row.id }),
    name: row.name,
    // validateCollection guarantees a data type before this is sent.
    dataType: row.dataType as DataType,
    description: orNull(row.description),
    position,
  };
}

function assignmentWrite(row: AssignmentRow): VariableAssignmentWrite {
  return {
    ...(row.id !== undefined && { id: row.id }),
    variableId: Number(row.variableId),
    screenId: Number(row.screenId),
    // validateCollection guarantees a function before this is sent.
    assignmentFunction: row.assignmentFunction as AssignmentFunction,
    tableFunction: orNull(row.tableFunction),
    usedIn: row.usedIn,
  };
}

/**
 * The COMPLETE write body: the three arrays are always there (an omitted array deletes what exists). `position` is
 * the visible order; a row without `id` is created, one with `id` is updated, a row that is no longer here is
 * deleted by the server (reconciliation by id).
 */
export function toCollectionWrite(values: CollectionFormValues): CollectionWrite {
  return {
    name: values.name,
    creationCondition: orNull(values.creationCondition),
    description: orNull(values.description),
    environments: environmentsToWrite(values.environments),
    fields: values.fields.map(fieldWrite),
    variableAssignments: values.assignments.map(assignmentWrite),
    derivedFrom: [...values.derivedFrom],
  };
}

/** The keys of the rows in the order they were sent: `fields[i]` of an error is `fields[i]` here. */
export interface SubmittedRows {
  fields: string[];
  assignments: string[];
  derivedFrom: number[];
  environments: Environment[];
}

export function submittedRows(values: CollectionFormValues): SubmittedRows {
  return {
    fields: values.fields.map((row) => row.key),
    assignments: values.assignments.map((row) => row.key),
    derivedFrom: [...values.derivedFrom],
    environments: environmentsToWrite(values.environments).map((e) => e.environment),
  };
}

export interface FieldRowErrors {
  name?: string;
  dataType?: string;
  description?: string;
  /** The whole row (an id that does not exist, a repeated id). */
  row?: string;
}

export interface AssignmentRowErrors {
  variableId?: string;
  screenId?: string;
  assignmentFunction?: string;
  tableFunction?: string;
  usedIn?: string;
  /** The whole row (a repeated assignment, an id that does not exist). */
  row?: string;
}

export interface CollectionFormErrors {
  name?: string;
  description?: string;
  creationCondition?: string;
  environments?: EnvironmentErrors['group'];
  environmentRows?: EnvironmentErrors['rows'];
  /** The Fields group (too many). */
  fields?: string;
  fieldRows?: Record<string, FieldRowErrors>;
  /** The assignments group (too many). */
  assignments?: string;
  assignmentRows?: Record<string, AssignmentRowErrors>;
  derivedFrom?: string;
  /** A message for the whole form (a server error that points to no field). */
  form?: string;
}

export function hasErrors(errors: CollectionFormErrors): boolean {
  const { environmentRows, fieldRows, assignmentRows, ...texts } = errors;
  const groups: Array<object | undefined> = [environmentRows, fieldRows, assignmentRows];
  return (
    Object.values(texts).some((text) => text !== undefined && text !== '') ||
    groups.some((group) => group !== undefined && Object.keys(group).length > 0)
  );
}

function validateField(row: FieldRow): FieldRowErrors {
  const errors: FieldRowErrors = {};
  if (row.name === '') errors.name = getRuleMessage('required', FIELD_LABEL.fieldName);
  else if (row.name.length > NAME_MAX_LENGTH)
    errors.name = getRuleMessage('maxLength', FIELD_LABEL.fieldName);
  if (row.dataType === '') errors.dataType = getRuleMessage('required', FIELD_LABEL.fieldDataType);
  if (row.description.length > FIELD_DESCRIPTION_MAX_LENGTH)
    errors.description = getRuleMessage('maxLength', FIELD_LABEL.fieldDescription);
  return errors;
}

function validateAssignment(row: AssignmentRow): AssignmentRowErrors {
  const errors: AssignmentRowErrors = {};
  if (row.variableId === '') errors.variableId = getRuleMessage('required', FIELD_LABEL.variable);
  if (row.screenId === '') errors.screenId = getRuleMessage('required', FIELD_LABEL.screen);
  if (row.assignmentFunction === '')
    errors.assignmentFunction = getRuleMessage('required', FIELD_LABEL.assignmentFunction);
  if (row.tableFunction.length > TABLE_FUNCTION_MAX_LENGTH)
    errors.tableFunction = getRuleMessage('maxLength', FIELD_LABEL.tableFunction);
  if (row.usedIn === '') errors.usedIn = getRuleMessage('required', FIELD_LABEL.usedIn);
  else if (row.usedIn.length > USED_IN_MAX_LENGTH)
    errors.usedIn = getRuleMessage('maxLength', FIELD_LABEL.usedIn);
  else if (!USED_IN_PATTERN.test(row.usedIn))
    errors.usedIn = getRuleMessage('pattern', FIELD_LABEL.usedIn);
  return errors;
}

export function validateCollection(values: CollectionFormValues): CollectionFormErrors {
  const errors: CollectionFormErrors = {};
  if (values.name === '') errors.name = getRuleMessage('required', FIELD_LABEL.name);
  else if (values.name.length > NAME_MAX_LENGTH)
    errors.name = getRuleMessage('maxLength', FIELD_LABEL.name);
  else if (!NAME_PATTERN.test(values.name))
    errors.name = getRuleMessage('pattern', FIELD_LABEL.name);
  if (values.description.length > TEXT_MAX_LENGTH)
    errors.description = getRuleMessage('maxLength', FIELD_LABEL.description);
  if (values.creationCondition.length > TEXT_MAX_LENGTH)
    errors.creationCondition = getRuleMessage('maxLength', FIELD_LABEL.creationCondition);

  const environments = validateEnvironments(values.environments);
  if (environments.group) errors.environments = environments.group;
  if (environments.rows) errors.environmentRows = environments.rows;

  if (values.fields.length > MAX_FIELDS)
    errors.fields = getRuleMessage('maxItems', FIELD_LABEL.fields);
  const fieldRows: Record<string, FieldRowErrors> = {};
  for (const row of values.fields) {
    const found = validateField(row);
    if (Object.keys(found).length > 0) fieldRows[row.key] = found;
  }
  if (Object.keys(fieldRows).length > 0) errors.fieldRows = fieldRows;

  if (values.assignments.length > MAX_ASSIGNMENTS)
    errors.assignments = getRuleMessage('maxItems', FIELD_LABEL.assignments);
  const assignmentRows: Record<string, AssignmentRowErrors> = {};
  for (const row of values.assignments) {
    const found = validateAssignment(row);
    if (Object.keys(found).length > 0) assignmentRows[row.key] = found;
  }
  if (Object.keys(assignmentRows).length > 0) errors.assignmentRows = assignmentRows;

  if (values.derivedFrom.length > MAX_DERIVED_FROM)
    errors.derivedFrom = getRuleMessage('maxItems', FIELD_LABEL.derivedFrom);
  return errors;
}

/** The rows with the one at `index` moved by `delta` (-1 up, +1 down); the same array when it cannot move. */
export function moveRow<T>(rows: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  const row = rows[index];
  if (row === undefined || target < 0 || target >= rows.length) return [...rows];
  const next = [...rows];
  next.splice(index, 1);
  next.splice(target, 0, row);
  return next;
}
