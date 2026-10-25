// deleteImpact: what deleting a collection takes with it, from the collection itself (GET /collections/{id}, S-17).
// deleteImpact(collection) -> { fields, assignments, derivations } counts of what is deleted too.
// impactSummary(impact) -> "Its 8 fields, 3 variable assignments and 1 derivation are deleted too.", or null when
// the collection has none of them. Only what the API gives is counted: it gives no screen links (D-79), no
// collections derived from this one and no counts it does not already return.
import { countText } from '../variables/variableLabels';

import type { Collection } from './collectionTypes';

export interface DeleteImpact {
  fields: number;
  assignments: number;
  derivations: number;
}

export function deleteImpact(collection: Collection): DeleteImpact {
  return {
    fields: collection.fields.length,
    assignments: collection.variableAssignments.length,
    derivations: collection.derivedFrom.length,
  };
}

export function impactSummary(impact: DeleteImpact): string | null {
  const parts: string[] = [];
  if (impact.fields > 0) parts.push(countText(impact.fields, 'field'));
  if (impact.assignments > 0) parts.push(countText(impact.assignments, 'variable assignment'));
  if (impact.derivations > 0) parts.push(countText(impact.derivations, 'derivation'));
  if (parts.length === 0) return null;
  const list =
    parts.length === 1
      ? (parts[0] ?? '')
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] ?? ''}`;
  const single =
    parts.length === 1 &&
    (impact.fields === 1 || impact.assignments === 1 || impact.derivations === 1);
  return `Its ${list} ${single ? 'is' : 'are'} deleted too.`;
}
