// variableLabels: the words the interface uses for the enums of a variable, and the date format of the lists.
// DATA_TYPE_LABEL: the names Microsoft gives the Power Fx data types (learn.microsoft.com, Power Fx "Data types").
// Registered as derived in docs/design/DESIGN_REFERENCE.md section 9.
import type {
  AccessMode,
  AssignmentFunction,
  DataType,
  Environment,
  VariableScope,
} from './variableTypes';

export const DATA_TYPES: readonly DataType[] = [
  'BOOLEAN',
  'CHOICE',
  'COLOR',
  'CURRENCY',
  'DATE',
  'DATE_TIME',
  'DECIMAL',
  'DYNAMIC',
  'FLOAT',
  'GUID',
  'HYPERLINK',
  'IMAGE',
  'MEDIA',
  'NUMBER',
  'RECORD',
  'RECORD_REFERENCE',
  'TABLE',
  'TEXT',
  'TIME',
  'YES_NO',
];

export const DATA_TYPE_LABEL: Record<DataType, string> = {
  BOOLEAN: 'Boolean',
  CHOICE: 'Choice',
  COLOR: 'Color',
  CURRENCY: 'Currency',
  DATE: 'Date',
  DATE_TIME: 'DateTime',
  DECIMAL: 'Decimal',
  DYNAMIC: 'Dynamic',
  FLOAT: 'Float',
  GUID: 'GUID',
  HYPERLINK: 'Hyperlink',
  IMAGE: 'Image',
  MEDIA: 'Media',
  NUMBER: 'Number',
  RECORD: 'Record',
  RECORD_REFERENCE: 'Record reference',
  TABLE: 'Table',
  TEXT: 'Text',
  TIME: 'Time',
  YES_NO: 'Yes/No',
};

export const SCOPES: readonly VariableScope[] = ['GLOBAL', 'CONTEXT'];
export const SCOPE_LABEL: Record<VariableScope, string> = { GLOBAL: 'Global', CONTEXT: 'Context' };
/** The Power Fx function that writes a variable of each scope (SCOPE_MISMATCH text). */
export const SCOPE_FUNCTION: Record<VariableScope, string> = {
  GLOBAL: 'Set',
  CONTEXT: 'UpdateContext',
};

export const ENVIRONMENTS: readonly Environment[] = ['DEV', 'PROD'];

export const ACCESS_MODE_LABEL: Record<AccessMode, string> = {
  READ: 'Read',
  WRITE: 'Write',
  READ_WRITE: 'Read/Write',
};

export const ASSIGNMENT_FUNCTION_LABEL: Record<AssignmentFunction, string> = {
  SET: 'Set',
  UPDATE_CONTEXT: 'UpdateContext',
};

/** The reserved name of the screen where the application starts (OnStart). */
export const APP_SCREEN_LABEL = 'App (OnStart)';

const pad = (value: number) => String(value).padStart(2, '0');

/** "2026-10-03 09:14" in the local time of the browser, as in the list frames. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "1 screen", "3 screens". */
export function countText(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
