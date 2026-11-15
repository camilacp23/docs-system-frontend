// graphTypes: the shapes of the dependency graph, taken from the generated API types (never written by hand).
// GraphNode is one of four variants told apart by `type`; GraphEdge is one of three told apart by `kind`
// (`ACCESSES` and `FEEDS` carry their own fields, the other five kinds carry none). A field that does not apply is
// absent, never null (D-104 c). NODE_TYPES and EDGE_KINDS list them in the order of the contract (nodes by type, edges
// by kind: SDD Table 63).
import type { components } from '../../api/schema';

export type GraphNode = components['schemas']['GraphNode'];
export type GraphEdge = components['schemas']['GraphEdge'];
export type NodeType = GraphNode['type'];
export type EdgeKind = GraphEdge['kind'];
export type ScreenNode = Extract<GraphNode, { type: 'SCREEN' }>;
export type VariableNode = Extract<GraphNode, { type: 'VARIABLE' }>;
export type ComponentNode = Extract<GraphNode, { type: 'COMPONENT' }>;
export type AccessEdge = Extract<GraphEdge, { kind: 'ACCESSES' }>;
export type FeedEdge = Extract<GraphEdge, { kind: 'FEEDS' }>;
export type Environment = components['schemas']['Environment'];

export interface GraphData {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
}

export const NODE_TYPES: readonly NodeType[] = ['SCREEN', 'VARIABLE', 'COLLECTION', 'COMPONENT'];

export const EDGE_KINDS: readonly EdgeKind[] = [
  'CONTAINS',
  'CREATES',
  'ACCESSES',
  'FEEDS',
  'USES',
  'DERIVES_FROM',
  'NAVIGATES_TO',
];

/** The plural the neighborhood endpoint takes in its path (`/dependencies/collections/21`). */
export const PATH_SEGMENT_BY_TYPE: Record<NodeType, string> = {
  SCREEN: 'screens',
  VARIABLE: 'variables',
  COLLECTION: 'collections',
  COMPONENT: 'components',
};

/** The node key the contract gives (`screen:12`): the type in lowercase and the id. */
export function nodeKeyOf(type: NodeType, id: number): string {
  return `${type.toLowerCase()}:${id}`;
}
