// editOptions: the options of the pickers of the screen edit page, from the elements of the screen's application.
//   variableOptions(variables, screenId, mode)  mode 'link' (a variable link: the rule of the context variables is shown)
//                                                or 'use' (what a component uses: only the scope is told)
//   collectionOptions(collections)              the collections, by name
//   screenOptions(screens, selfId)              the screens a navigation can go to: never the screen itself
//   withChosen(options, chosen)                 keeps the elements the saved screen points at selectable
//   variableAccess(variable, screenId)          'any' | 'write-only' | 'blocked': what the form offers for a variable link
// The rule is the one of CP-07 / D-52: a context variable belongs to its origin screen; from any other screen it can
// only be written (Navigate), and without an origin screen it cannot be linked at all. This is usability only: the API
// judges it (CONTEXT_SCREEN_MISMATCH) and its answer is shown on the row.
import type { SearchPickerOption } from '../../components/ui';
import type { CollectionSummary } from '../collections/collectionTypes';
import type { ScreenSummary, VariableSummary } from '../variables/variableTypes';

export type VariableAccess = 'any' | 'write-only' | 'blocked';

interface VariableRule {
  scope: VariableSummary['scope'];
  originScreen: { id: number } | null;
}

export function variableAccess(
  variable: VariableRule | undefined,
  screenId: number,
): VariableAccess {
  if (variable === undefined || variable.scope === 'GLOBAL') return 'any';
  if (variable.originScreen === null) return 'blocked';
  return variable.originScreen.id === screenId ? 'any' : 'write-only';
}

export const NO_ORIGIN_REASON = 'Context · set its origin screen first';
export const WRITE_ONLY_REASON = 'Other screens can only set it through Navigate.';

export function variableOptions(
  variables: readonly VariableSummary[],
  screenId: number,
  mode: 'link' | 'use',
): SearchPickerOption[] {
  return variables.map((variable) => {
    const access = variableAccess(variable, screenId);
    const origin = variable.originScreen?.name;
    if (variable.scope === 'GLOBAL') {
      return {
        value: String(variable.id),
        label: variable.name,
        detail: origin ? `Global · ${origin}` : 'Global',
      };
    }
    if (mode === 'use') {
      return {
        value: String(variable.id),
        label: variable.name,
        detail: origin ? `Context · ${origin}` : 'Context · no origin screen',
      };
    }
    if (access === 'blocked') {
      return {
        value: String(variable.id),
        label: variable.name,
        detail: NO_ORIGIN_REASON,
        disabled: true,
      };
    }
    return {
      value: String(variable.id),
      label: variable.name,
      detail:
        access === 'write-only'
          ? `Context · ${origin ?? ''} · write only`
          : `Context · ${origin ?? ''}`,
    };
  });
}

export function collectionOptions(collections: readonly CollectionSummary[]): SearchPickerOption[] {
  return collections.map((collection) => ({
    value: String(collection.id),
    label: collection.name,
  }));
}

export function screenOptions(
  screens: readonly Pick<ScreenSummary, 'id' | 'name'>[],
  selfId: number,
): SearchPickerOption[] {
  return screens
    .filter((screen) => screen.id !== selfId)
    .map((screen) => ({ value: String(screen.id), label: screen.name }));
}

/** Adds to `options` the elements the saved screen already points at that the list does not have (by id). */
export function withChosen(
  options: readonly SearchPickerOption[],
  chosen: ReadonlyArray<{ id: number; name: string }>,
): SearchPickerOption[] {
  const known = new Set(options.map((option) => option.value));
  return [
    ...options,
    ...chosen
      .filter((item) => !known.has(String(item.id)))
      .map((item) => ({ value: String(item.id), label: item.name })),
  ];
}
