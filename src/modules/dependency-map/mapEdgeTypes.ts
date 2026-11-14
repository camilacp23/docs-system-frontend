// mapEdgeTypes: the `edgeTypes` table of React Flow. A module constant on purpose, like the node types: React Flow warns and
// draws every edge again when this object changes between renders.
import { RoutedEdge } from './RoutedEdge';

export const MAP_EDGE_TYPES = { routed: RoutedEdge };
