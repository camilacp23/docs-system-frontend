// mapNodeTypes: the `nodeTypes` table of React Flow. A module constant on purpose: React Flow warns and draws every node
// again when this object changes between renders, so it must never be built inside a component.
import {
  CollectionMapNode,
  ComponentMapNode,
  ScreenMapNode,
  VariableMapNode,
} from './nodes/MapNodes';

export const MAP_NODE_TYPES = {
  screen: ScreenMapNode,
  variable: VariableMapNode,
  collection: CollectionMapNode,
  component: ComponentMapNode,
};
