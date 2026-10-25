// deleteImpact: what deleting a variable takes with it, from GET /variables/{id}/dependencies (S-13).
// deleteImpact(dependencies) -> { screens, collections, components } counts of the links, assignments and
// dependencies that are deleted too (the origin screen counts as a screen).
// impactSummary(impact) -> "is used in 3 screens, fed from 1 collection and used by 1 component", or null when the
// variable is linked to nothing.
import { countText } from './variableLabels';
import type { VariableDependencies } from './variableTypes';

export interface DeleteImpact {
  screens: number;
  collections: number;
  components: number;
}

export function deleteImpact(dependencies: VariableDependencies): DeleteImpact {
  return {
    screens: dependencies.screens.length + (dependencies.originScreen === null ? 0 : 1),
    collections: dependencies.collections.length,
    components: dependencies.components.length,
  };
}

export function impactSummary(impact: DeleteImpact): string | null {
  const parts: string[] = [];
  if (impact.screens > 0) parts.push(`is used in ${countText(impact.screens, 'screen')}`);
  if (impact.collections > 0) parts.push(`fed from ${countText(impact.collections, 'collection')}`);
  if (impact.components > 0) parts.push(`used by ${countText(impact.components, 'component')}`);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0] ?? null;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
