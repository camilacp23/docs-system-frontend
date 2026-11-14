// mapNodeTypes: the `nodeTypes` table of React Flow, by the kind of box of the scene. A module constant on purpose: React
// Flow warns and draws every node again when this object changes between renders, so it must never be built inside a
// component.
import {
  CollectionMapNode,
  ComponentMapNode,
  MoreMapNode,
  ScreenCardNode,
  ScreenGroupNode,
  ScreenMapNode,
  VariableMapNode,
} from './nodes/MapNodes';

export const MAP_NODE_TYPES = {
  screenCard: ScreenCardNode,
  screen: ScreenMapNode,
  screenGroup: ScreenGroupNode,
  variable: VariableMapNode,
  collection: CollectionMapNode,
  component: ComponentMapNode,
  more: MoreMapNode,
};
