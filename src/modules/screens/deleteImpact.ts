// deleteImpact: what deleting a screen takes with it, from what the API gives (S-26).
// screenDeleteImpact(screen, orphanedVariables) -> { components, links, comments, pendingTodos,
// orphanedVariables }
//   components   `components` of GET /screens/{id}
//   links        the variable links that are not origin rows, the collection links and the navigations of the
//                screen; origin rows are the variables' own record of where they were created, and those
//                variables are counted apart
//   comments     `commentCount` of the screen
//   pendingTodos `pendingSubtasks` of the screen: its local to-do records whose Jira status is not done (the API
//                gives no count of the done ones, so none is calculated)
//   orphanedVariables  the `total` of GET /variables?originScreenId=<id>: variables created in the screen, which
//                keep existing without an origin screen
// impactSummary(impact, name) -> the sentence of the confirmation. Only what the API gives is counted: no
// navigations from other screens to this one, no total of local to-do records (only the pending ones).
import { countText } from '../variables/variableLabels';

import type { Screen } from './screenTypes';

export interface ScreenDeleteImpact {
  components: number;
  links: number;
  comments: number;
  pendingTodos: number;
  orphanedVariables: number;
}

export function screenDeleteImpact(screen: Screen, orphanedVariables: number): ScreenDeleteImpact {
  return {
    components: screen.components.length,
    links:
      screen.variableLinks.filter((link) => !link.isOrigin).length +
      screen.collectionLinks.length +
      screen.navigations.length,
    comments: screen.commentCount,
    pendingTodos: screen.pendingSubtasks,
    orphanedVariables,
  };
}

function joinParts(parts: readonly string[]): string {
  return parts.length === 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] ?? ''}`;
}

export const JIRA_STAY_TEXT = 'The Jira issues stay in Jira.';

export function impactSummary(impact: ScreenDeleteImpact, name: string): string {
  const parts: string[] = [];
  if (impact.components > 0) parts.push(countText(impact.components, 'component'));
  if (impact.links > 0) parts.push(countText(impact.links, 'link'));
  if (impact.comments > 0) parts.push(countText(impact.comments, 'comment'));
  if (impact.pendingTodos > 0) parts.push(countText(impact.pendingTodos, 'pending to-do record'));
  const deleted =
    parts.length === 0
      ? `${name} has no components or links.`
      : `Its ${joinParts(parts)} ${parts.length === 1 && parts[0]?.startsWith('1 ') ? 'is' : 'are'} deleted too.`;
  const orphaned =
    impact.orphanedVariables === 0
      ? ''
      : impact.orphanedVariables === 1
        ? ' 1 variable created in it stays without an origin screen.'
        : ` ${impact.orphanedVariables} variables created in it stay without an origin screen.`;
  return `${deleted}${orphaned} ${JIRA_STAY_TEXT}`;
}
