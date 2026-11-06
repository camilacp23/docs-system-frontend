// deleteImpact: what deleting a screen takes with it, from what the API gives (S-26).
// screenDeleteImpact(screen, orphanedVariables) -> { components, links, orphanedVariables }
//   components   `components` of GET /screens/{id}
//   links        the variable links that are not origin rows, the collection links and the navigations of the
//                screen; origin rows are the variables' own record of where they were created, and those
//                variables are counted apart
//   orphanedVariables  the `total` of GET /variables?originScreenId=<id>: variables created in the screen, which
//                keep existing without an origin screen
// impactSummary(impact, name) -> the sentence of the confirmation. Only what the API gives is counted: no
// comments, no local to-do records, no navigations from other screens to this one.
import { countText } from '../variables/variableLabels';

import type { Screen } from './screenTypes';

export interface ScreenDeleteImpact {
  components: number;
  links: number;
  orphanedVariables: number;
}

export function screenDeleteImpact(screen: Screen, orphanedVariables: number): ScreenDeleteImpact {
  return {
    components: screen.components.length,
    links:
      screen.variableLinks.filter((link) => !link.isOrigin).length +
      screen.collectionLinks.length +
      screen.navigations.length,
    orphanedVariables,
  };
}

export const JIRA_STAY_TEXT = 'The Jira issues stay in Jira.';

export function impactSummary(impact: ScreenDeleteImpact, name: string): string {
  const parts: string[] = [];
  if (impact.components > 0) parts.push(countText(impact.components, 'component'));
  if (impact.links > 0) parts.push(countText(impact.links, 'link'));
  const deleted =
    parts.length === 0
      ? `${name} has no components or links.`
      : `Its ${parts.join(' and ')} ${parts.length === 1 && parts[0]?.startsWith('1 ') ? 'is' : 'are'} deleted too.`;
  const orphaned =
    impact.orphanedVariables === 0
      ? ''
      : impact.orphanedVariables === 1
        ? ' 1 variable created in it stays without an origin screen.'
        : ` ${impact.orphanedVariables} variables created in it stay without an origin screen.`;
  return `${deleted}${orphaned} ${JIRA_STAY_TEXT}`;
}
