// nodeLabels: the text of a node of the map.
// truncateName(name, type) -> the name cut with "…" when it does not fit the fixed box of its type; the full name is
//   always in the accessible name and the tooltip (title) of the node.
// nodeAriaLabel(node, counters?) -> "Screen Inicio, Approved", "Variable gUsuario, Global, untraced", "Collection
//   colClientes", "Component btnGuardar": what a screen reader says for the button of a node. The card of a screen in the
//   Screens view adds its counters: "Screen Inicio, Approved, 3 components, 2 variables, 1 collection".
import { DOCUMENTATION_STATUS_LABEL } from '../../components/ui';
import { RESERVED_LABEL, toTagStatus } from '../screens/screenLabels';
import { countText, SCOPE_LABEL } from '../variables/variableLabels';

import { NODE_TYPE_LABEL } from './graphLabels';
import type { GraphNode, NodeType } from './graphTypes';
import type { SceneCounters } from './scene';

/** How many characters of the name fit the box of each type (IBM Plex Mono 13 px next to its icon). */
export const MAX_NAME_CHARS: Record<NodeType, number> = {
  SCREEN: 22,
  VARIABLE: 19,
  COLLECTION: 19,
  COMPONENT: 16,
};

export function truncateName(name: string, type: NodeType): string {
  const max = MAX_NAME_CHARS[type];
  return name.length <= max ? name : `${name.slice(0, max - 1)}…`;
}

export function nodeAriaLabel(node: GraphNode, counters: SceneCounters | null = null): string {
  const parts: string[] = [];
  switch (node.type) {
    case 'SCREEN':
      parts.push(DOCUMENTATION_STATUS_LABEL[toTagStatus(node.documentationStatus)]);
      if (node.isAppContext) parts.push(RESERVED_LABEL);
      break;
    case 'VARIABLE':
      parts.push(SCOPE_LABEL[node.scope]);
      if (node.untraced) parts.push('untraced');
      break;
    default:
      break;
  }
  if (counters !== null) {
    parts.push(
      countText(counters.components, 'component'),
      countText(counters.variables, 'variable'),
      countText(counters.collections, 'collection'),
    );
  }
  return [`${NODE_TYPE_LABEL[node.type]} ${node.name}`, ...parts].join(', ');
}
