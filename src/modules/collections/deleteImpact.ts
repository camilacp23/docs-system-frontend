// deleteImpact: what deleting a collection takes with it (S-17): its own parts, from GET /collections/{id}, and its
// links to screens, from the screens that use it (GET /dependencies/collections/{id}?depth=1, D-103).
// deleteImpact(collection, screens) -> { fields, assignments, derivations, screens } counts of what is deleted too;
//   `screens` is the number of DISTINCT screens that use the collection (not the number of links).
// impactSummary(impact) -> "Its 8 fields, 3 variable assignments, 1 derivation and its links to 2 screens are deleted
// too.", or null when there is nothing. Only what the API gives is counted: no collections derived from this one.
import { countText } from '../variables/variableLabels';

import type { Collection } from './collectionTypes';

export interface DeleteImpact {
  fields: number;
  assignments: number;
  derivations: number;
  screens: number;
}

export function deleteImpact(collection: Collection, screens: number): DeleteImpact {
  return {
    fields: collection.fields.length,
    assignments: collection.variableAssignments.length,
    derivations: collection.derivedFrom.length,
    screens,
  };
}

export function impactSummary(impact: DeleteImpact): string | null {
  const parts: string[] = [];
  if (impact.fields > 0) parts.push(countText(impact.fields, 'field'));
  if (impact.assignments > 0) parts.push(countText(impact.assignments, 'variable assignment'));
  if (impact.derivations > 0) parts.push(countText(impact.derivations, 'derivation'));
  if (impact.screens > 0) {
    // "its links to 2 screens": the sentence already starts with "Its", so the word is added only when it is not first.
    const links = `${impact.screens === 1 ? 'link' : 'links'} to ${countText(impact.screens, 'screen')}`;
    parts.push(parts.length === 0 ? links : `its ${links}`);
  }
  if (parts.length === 0) return null;
  const list =
    parts.length === 1
      ? (parts[0] ?? '')
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] ?? ''}`;
  const single =
    parts.length === 1 &&
    (impact.fields === 1 ||
      impact.assignments === 1 ||
      impact.derivations === 1 ||
      impact.screens === 1);
  return `Its ${list} ${single ? 'is' : 'are'} deleted too.`;
}
