// screenUsage: the screens that use a collection, from GET /dependencies/collections/{id}?depth=1 (D-103).
// groupScreenUsage(data, collectionId) -> one entry per screen, in the order of the response (nodes by id), each with its
// uses (the `accessMode` and `usedIn` of every link, in the order of the edges).
// The screens are the SCREEN nodes with an ACCESSES edge to the collection. The API gives ONE edge per link, so a screen
// that uses the collection in two places has two edges: they are grouped here, and the number of screens is the number
// of distinct screens, never the number of edges. App (OnStart) is a screen like the others (D-57).
import type { components } from '../../api/schema';
import type { GraphData } from '../dependency-map/graphTypes';

export const USED_BY_SCREENS_EMPTY_TEXT = 'No screen uses this collection yet.';
export const USED_BY_SCREENS_FAILED_LEAD = "Couldn't load the screens that use this collection.";

export interface ScreenUse {
  accessMode: components['schemas']['AccessMode'];
  usedIn: string;
}

export interface ScreenUsage {
  screen: { id: number; name: string; isAppContext: boolean };
  uses: ScreenUse[];
}

export function groupScreenUsage(data: GraphData, collectionId: number): ScreenUsage[] {
  const target = `collection:${collectionId}`;
  const usesByScreen = new Map<string, ScreenUse[]>();
  for (const edge of data.edges) {
    if (edge.kind !== 'ACCESSES' || edge.target !== target) continue;
    const uses = usesByScreen.get(edge.source);
    const use = { accessMode: edge.accessMode, usedIn: edge.usedIn };
    if (uses) uses.push(use);
    else usesByScreen.set(edge.source, [use]);
  }
  const groups: ScreenUsage[] = [];
  for (const node of data.nodes) {
    if (node.type !== 'SCREEN') continue;
    const uses = usesByScreen.get(node.key);
    if (uses) {
      groups.push({
        screen: { id: node.id, name: node.name, isAppContext: node.isAppContext },
        uses,
      });
    }
  }
  return groups;
}
