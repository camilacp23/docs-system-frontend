// screenEditForm: the form model of the screen edit page (S-20 to S-22) and the body of PUT /screens/{id}.
//   valuesFromScreen(screen)     -> the initial form values (origin links are kept apart, read only)
//   toScreenUpdate(values)       -> the COMPLETE body: name, Miro link, the seven template fields and the four lists, which
//                                   ALWAYS travel (an omitted list is a 400). `uses` of a component travels only when the
//                                   component has some (omitting it deletes them, contract 0.3.5). A row that exists keeps
//                                   its `id` (reconciliation by id, D-26); a new row has none. Origin rows are never sent.
//   submittedRows(values)        -> the row keys in the order they were sent, to put a server error (which only knows a
//                                   position, `components[2].uses[1].targetId`) on the row that was at that position
//   validateScreenEdit(values)   -> the errors of the rules the CONTRACT declares (required, patterns, lengths, maxItems);
//                                   every other rule (duplicates, self, references) is the server's
//   errorTab(errors)             -> the first tab of the form that has an error
// `key` of a row is local to the browser (React key and key of the errors): it never travels.
import { getRuleMessage } from '../../api/messages';
import { ACCESS_MODE_LABEL } from '../variables/variableLabels';
import type { AccessMode } from '../variables/variableTypes';

import { TEMPLATE_FIELDS, type TemplateKey } from './templateFields';
import type { Screen, ScreenUpdate } from './screenTypes';

/** Limits and patterns of ScreenWrite in the contract. */
export const NAME_MAX_LENGTH = 150;
export const MIRO_LINK_MAX_LENGTH = 2048;
export const MIRO_LINK_PATTERN = /^https:\/\//;
export const LONG_TEXT_MAX_LENGTH = 20000;
export const COMPONENT_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const COMPONENT_NAME_MAX_LENGTH = 150;
export const COMPONENT_TYPE_MAX_LENGTH = 60;
export const COMPONENT_DESCRIPTION_MAX_LENGTH = 4000;
export const USE_DESCRIPTION_MAX_LENGTH = 2000;
export const NAVIGATION_DESCRIPTION_MAX_LENGTH = 2000;
export const USED_IN_MAX_LENGTH = 200;
export const USED_IN_PATTERN = /^(?!origin$)[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;
export const MAX_COMPONENTS = 300;
export const MAX_USES = 100;
export const MAX_VARIABLE_LINKS = 500;
export const MAX_COLLECTION_LINKS = 500;
export const MAX_NAVIGATIONS = 100;

export type UseTargetType = 'VARIABLE' | 'COLLECTION';
export type EditTab = 'template' | 'components' | 'links';
/** The tabs of the form in the order they are drawn. */
export const EDIT_TABS: readonly EditTab[] = ['template', 'components', 'links'];

export const FIELD_LABEL = {
  name: 'Name',
  miroLink: 'Miro link',
  components: 'Components',
  componentName: 'Name',
  componentType: 'Type',
  onSelect: 'OnSelect',
  componentDescription: 'Description',
  uses: 'Uses',
  useType: 'Type',
  useTarget: 'Target',
  useDescription: 'Description',
  navigations: 'Navigation',
  navigationTarget: 'Target screen',
  navigationDescription: 'Description',
  variableLinks: 'Variables',
  variable: 'Variable',
  collectionLinks: 'Collections',
  collection: 'Collection',
  accessMode: 'Access',
  usedIn: 'Used in',
} as const;

export interface UseRow {
  /** Local key (React and errors); never sent. */
  key: string;
  /** The id of an existing use; absent on a new row. */
  id?: number;
  targetType: UseTargetType | '';
  /** Id as text, '' = not chosen yet. */
  targetId: string;
  description: string;
}

export interface ComponentRow {
  key: string;
  id?: number;
  name: string;
  type: string;
  onSelect: string;
  description: string;
  uses: UseRow[];
}

export interface VariableLinkRow {
  key: string;
  id?: number;
  variableId: string;
  accessMode: AccessMode;
  usedIn: string;
}

export interface CollectionLinkRow {
  key: string;
  id?: number;
  collectionId: string;
  accessMode: AccessMode;
  usedIn: string;
}

export interface NavigationRow {
  key: string;
  id?: number;
  targetScreenId: string;
  description: string;
}

/**
 * A link the variables module keeps (`isOrigin`): the row that says the variable is created in this screen. It is never part of
 * the PUT of the screen (the API keeps it), but its "Used in" (`originUsedIn`) is edited here and saved on the VARIABLE with its own
 * PUT /variables/{id} (contract 0.5.0). `originUsedIn` is the text of the field ('' = not described).
 */
export interface OriginLink {
  id: number;
  variable: { id: number; name: string };
  accessMode: AccessMode;
  originUsedIn: string;
}

export interface ScreenEditValues {
  name: string;
  miroLink: string;
  template: Record<TemplateKey, string>;
  components: ComponentRow[];
  variableLinks: VariableLinkRow[];
  collectionLinks: CollectionLinkRow[];
  navigations: NavigationRow[];
  origins: OriginLink[];
}

let rowCounter = 0;
/** A key for a row that exists only in the browser. */
export function newRowKey(): string {
  rowCounter += 1;
  return `new-${rowCounter}`;
}

export function newUseRow(): UseRow {
  return { key: newRowKey(), targetType: 'VARIABLE', targetId: '', description: '' };
}

export function newComponentRow(): ComponentRow {
  return { key: newRowKey(), name: '', type: '', onSelect: '', description: '', uses: [] };
}

export function newVariableLinkRow(): VariableLinkRow {
  return { key: newRowKey(), variableId: '', accessMode: 'READ', usedIn: '' };
}

export function newCollectionLinkRow(): CollectionLinkRow {
  return { key: newRowKey(), collectionId: '', accessMode: 'READ', usedIn: '' };
}

export function newNavigationRow(): NavigationRow {
  return { key: newRowKey(), targetScreenId: '', description: '' };
}

export function valuesFromScreen(screen: Screen): ScreenEditValues {
  return {
    name: screen.name,
    miroLink: screen.miroLink ?? '',
    template: Object.fromEntries(
      TEMPLATE_FIELDS.map((field) => [field.key, screen.template[field.key] ?? '']),
    ) as Record<TemplateKey, string>,
    components: screen.components.map((component) => ({
      key: `component-${component.id}`,
      id: component.id,
      name: component.name,
      type: component.type,
      onSelect: component.onSelect ?? '',
      description: component.description ?? '',
      uses: component.uses.map((use) => ({
        key: `use-${use.id}`,
        id: use.id,
        targetType: use.targetType,
        targetId: String(use.target.id),
        description: use.description ?? '',
      })),
    })),
    variableLinks: screen.variableLinks
      .filter((link) => !link.isOrigin)
      .map((link) => ({
        key: `variable-link-${link.id}`,
        id: link.id,
        variableId: String(link.variable.id),
        accessMode: link.accessMode,
        usedIn: link.usedIn,
      })),
    collectionLinks: screen.collectionLinks.map((link) => ({
      key: `collection-link-${link.id}`,
      id: link.id,
      collectionId: String(link.collection.id),
      accessMode: link.accessMode,
      usedIn: link.usedIn,
    })),
    navigations: screen.navigations.map((navigation) => ({
      key: `navigation-${navigation.id}`,
      id: navigation.id,
      targetScreenId: String(navigation.targetScreen.id),
      description: navigation.description ?? '',
    })),
    origins: screen.variableLinks
      .filter((link) => link.isOrigin)
      .map((link) => ({
        id: link.id,
        variable: link.variable,
        accessMode: link.accessMode,
        originUsedIn: link.originUsedIn ?? '',
      })),
  };
}

const orNull = (text: string): string | null => (text === '' ? null : text);

/** The COMPLETE write body (see the header). */
export function toScreenUpdate(values: ScreenEditValues): ScreenUpdate {
  return {
    name: values.name.trim(),
    miroLink: orNull(values.miroLink.trim()),
    template: Object.fromEntries(
      TEMPLATE_FIELDS.map((field) => [field.key, orNull(values.template[field.key])]),
    ) as ScreenUpdate['template'],
    components: values.components.map((row) => ({
      ...(row.id !== undefined && { id: row.id }),
      name: row.name,
      type: row.type,
      onSelect: orNull(row.onSelect),
      description: orNull(row.description),
      ...(row.uses.length > 0 && {
        uses: row.uses.map((use) => ({
          ...(use.id !== undefined && { id: use.id }),
          // validateScreenEdit guarantees the type and the target before this is sent.
          targetType: use.targetType as UseTargetType,
          targetId: Number(use.targetId),
          description: orNull(use.description),
        })),
      }),
    })),
    variableLinks: values.variableLinks.map((row) => ({
      ...(row.id !== undefined && { id: row.id }),
      variableId: Number(row.variableId),
      accessMode: row.accessMode,
      usedIn: row.usedIn,
    })),
    collectionLinks: values.collectionLinks.map((row) => ({
      ...(row.id !== undefined && { id: row.id }),
      collectionId: Number(row.collectionId),
      accessMode: row.accessMode,
      usedIn: row.usedIn,
    })),
    navigations: values.navigations.map((row) => ({
      ...(row.id !== undefined && { id: row.id }),
      targetScreenId: Number(row.targetScreenId),
      description: orNull(row.description),
    })),
  };
}

/** The keys of the rows in the order they were sent: `components[i]` of an error is `components[i]` here. */
export interface SubmittedRows {
  components: string[];
  /** The keys of the uses of each component, by the position of the component. */
  uses: string[][];
  variableLinks: string[];
  collectionLinks: string[];
  navigations: string[];
}

export function submittedRows(values: ScreenEditValues): SubmittedRows {
  return {
    components: values.components.map((row) => row.key),
    uses: values.components.map((row) => row.uses.map((use) => use.key)),
    variableLinks: values.variableLinks.map((row) => row.key),
    collectionLinks: values.collectionLinks.map((row) => row.key),
    navigations: values.navigations.map((row) => row.key),
  };
}

export interface UseRowErrors {
  targetType?: string;
  targetId?: string;
  description?: string;
  /** The whole row (an id that does not exist, a repeated target). */
  row?: string;
}

export interface ComponentRowErrors {
  name?: string;
  type?: string;
  onSelect?: string;
  description?: string;
  /** The uses group (too many). */
  uses?: string;
  useRows?: Record<string, UseRowErrors>;
  row?: string;
}

export interface VariableLinkRowErrors {
  variableId?: string;
  accessMode?: string;
  usedIn?: string;
  row?: string;
}

export interface CollectionLinkRowErrors {
  collectionId?: string;
  accessMode?: string;
  usedIn?: string;
  row?: string;
}

export interface NavigationRowErrors {
  targetScreenId?: string;
  description?: string;
  row?: string;
}

export interface ScreenEditErrors {
  name?: string;
  miroLink?: string;
  template?: Partial<Record<TemplateKey, string>>;
  components?: string;
  componentRows?: Record<string, ComponentRowErrors>;
  variableLinks?: string;
  variableLinkRows?: Record<string, VariableLinkRowErrors>;
  collectionLinks?: string;
  collectionLinkRows?: Record<string, CollectionLinkRowErrors>;
  navigations?: string;
  navigationRows?: Record<string, NavigationRowErrors>;
  /** "Used in" of the origin rows, by the id of the link. */
  originRows?: Record<number, string>;
  /** A message for the whole form (a server error that points to no field). */
  form?: string;
}

const present = (group: object | undefined): boolean =>
  group !== undefined && Object.keys(group).length > 0;

export function hasErrors(errors: ScreenEditErrors): boolean {
  return (
    [
      errors.name,
      errors.miroLink,
      errors.components,
      errors.variableLinks,
      errors.collectionLinks,
      errors.navigations,
      errors.form,
    ].some((text) => text !== undefined && text !== '') ||
    [
      errors.template,
      errors.componentRows,
      errors.variableLinkRows,
      errors.collectionLinkRows,
      errors.navigationRows,
      errors.originRows,
    ].some(present)
  );
}

/** The first tab that has an error to show, or null when the only error is the form banner. */
export function errorTab(errors: ScreenEditErrors): EditTab | null {
  if (errors.name || errors.miroLink || present(errors.template)) return 'template';
  if (errors.components || present(errors.componentRows)) return 'components';
  if (errors.navigations || present(errors.navigationRows)) return 'components';
  if (
    errors.variableLinks ||
    errors.collectionLinks ||
    present(errors.variableLinkRows) ||
    present(errors.collectionLinkRows) ||
    present(errors.originRows)
  )
    return 'links';
  return null;
}

function requiredText(
  text: string,
  label: string,
  max: number,
  pattern?: RegExp,
): string | undefined {
  if (text === '') return getRuleMessage('required', label);
  if (text.length > max) return getRuleMessage('maxLength', label);
  if (pattern !== undefined && !pattern.test(text)) return getRuleMessage('pattern', label);
  return undefined;
}

const tooLong = (text: string, max: number, label: string): string | undefined =>
  text.length > max ? getRuleMessage('maxLength', label) : undefined;

function addErrors<T extends object>(
  target: Record<string, T> | undefined,
  key: string,
  found: T,
): Record<string, T> | undefined {
  if (Object.values(found).every((value) => value === undefined)) return target;
  return { ...target, [key]: found };
}

function validateUse(use: UseRow): UseRowErrors {
  return {
    targetType: use.targetType === '' ? getRuleMessage('required', FIELD_LABEL.useType) : undefined,
    targetId: use.targetId === '' ? getRuleMessage('required', FIELD_LABEL.useTarget) : undefined,
    description: tooLong(use.description, USE_DESCRIPTION_MAX_LENGTH, FIELD_LABEL.useDescription),
  };
}

function validateComponent(row: ComponentRow): ComponentRowErrors {
  let useRows: Record<string, UseRowErrors> | undefined;
  for (const use of row.uses) useRows = addErrors(useRows, use.key, validateUse(use));
  return {
    name: requiredText(
      row.name,
      FIELD_LABEL.componentName,
      COMPONENT_NAME_MAX_LENGTH,
      COMPONENT_NAME_PATTERN,
    ),
    type: requiredText(row.type, FIELD_LABEL.componentType, COMPONENT_TYPE_MAX_LENGTH),
    onSelect: tooLong(row.onSelect, LONG_TEXT_MAX_LENGTH, FIELD_LABEL.onSelect),
    description: tooLong(
      row.description,
      COMPONENT_DESCRIPTION_MAX_LENGTH,
      FIELD_LABEL.componentDescription,
    ),
    uses: row.uses.length > MAX_USES ? getRuleMessage('maxItems', FIELD_LABEL.uses) : undefined,
    useRows,
  };
}

function validateLink(
  element: string,
  label: string,
  usedIn: string,
): { element?: string; usedIn?: string } {
  return {
    element: element === '' ? getRuleMessage('required', label) : undefined,
    usedIn: requiredText(usedIn, FIELD_LABEL.usedIn, USED_IN_MAX_LENGTH, USED_IN_PATTERN),
  };
}

/** The text of an origin row's "Used in": optional, with the format of `usedIn` (never `origin`). */
export function validateOriginUsedIn(text: string): string | undefined {
  const used = text.trim();
  if (used === '') return undefined;
  if (used.length > USED_IN_MAX_LENGTH) return getRuleMessage('maxLength', FIELD_LABEL.usedIn);
  if (!USED_IN_PATTERN.test(used)) return getRuleMessage('pattern', FIELD_LABEL.usedIn);
  return undefined;
}

/** The origin rows whose "Used in" the user changed: each one is a PUT of its variable. */
export function changedOrigins(values: ScreenEditValues, screen: Screen): OriginLink[] {
  return values.origins.filter((origin) => {
    const before = screen.variableLinks.find((link) => link.id === origin.id)?.originUsedIn ?? null;
    return origin.originUsedIn.trim() !== (before ?? '');
  });
}

export function validateScreenEdit(values: ScreenEditValues): ScreenEditErrors {
  const errors: ScreenEditErrors = {};
  for (const origin of values.origins) {
    const found = validateOriginUsedIn(origin.originUsedIn);
    if (found !== undefined) errors.originRows = { ...errors.originRows, [origin.id]: found };
  }
  const name = requiredText(values.name.trim(), FIELD_LABEL.name, NAME_MAX_LENGTH);
  if (name !== undefined) errors.name = name;
  const link = values.miroLink.trim();
  if (link !== '') {
    if (link.length > MIRO_LINK_MAX_LENGTH)
      errors.miroLink = getRuleMessage('maxLength', FIELD_LABEL.miroLink);
    else if (!MIRO_LINK_PATTERN.test(link))
      errors.miroLink = getRuleMessage('pattern', FIELD_LABEL.miroLink);
  }
  for (const field of TEMPLATE_FIELDS) {
    const text = tooLong(values.template[field.key], LONG_TEXT_MAX_LENGTH, field.label);
    if (text !== undefined) errors.template = { ...errors.template, [field.key]: text };
  }

  if (values.components.length > MAX_COMPONENTS)
    errors.components = getRuleMessage('maxItems', FIELD_LABEL.components);
  for (const row of values.components) {
    errors.componentRows = addErrors(errors.componentRows, row.key, validateComponent(row));
  }

  if (values.variableLinks.length > MAX_VARIABLE_LINKS)
    errors.variableLinks = getRuleMessage('maxItems', FIELD_LABEL.variableLinks);
  for (const row of values.variableLinks) {
    const found = validateLink(row.variableId, FIELD_LABEL.variable, row.usedIn);
    errors.variableLinkRows = addErrors(errors.variableLinkRows, row.key, {
      variableId: found.element,
      usedIn: found.usedIn,
    });
  }

  if (values.collectionLinks.length > MAX_COLLECTION_LINKS)
    errors.collectionLinks = getRuleMessage('maxItems', FIELD_LABEL.collectionLinks);
  for (const row of values.collectionLinks) {
    const found = validateLink(row.collectionId, FIELD_LABEL.collection, row.usedIn);
    errors.collectionLinkRows = addErrors(errors.collectionLinkRows, row.key, {
      collectionId: found.element,
      usedIn: found.usedIn,
    });
  }

  if (values.navigations.length > MAX_NAVIGATIONS)
    errors.navigations = getRuleMessage('maxItems', FIELD_LABEL.navigations);
  for (const row of values.navigations) {
    errors.navigationRows = addErrors(errors.navigationRows, row.key, {
      targetScreenId:
        row.targetScreenId === ''
          ? getRuleMessage('required', FIELD_LABEL.navigationTarget)
          : undefined,
      description: tooLong(
        row.description,
        NAVIGATION_DESCRIPTION_MAX_LENGTH,
        FIELD_LABEL.navigationDescription,
      ),
    });
  }
  return errors;
}

/** Access modes in the order the radios are drawn. */
export const ACCESS_MODES: readonly AccessMode[] = ['READ', 'WRITE', 'READ_WRITE'];
export { ACCESS_MODE_LABEL };
