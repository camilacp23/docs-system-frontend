// graphModel: from the response of the API to what React Flow draws.
// toFlowGraph(data, positions) -> { nodes, edges }
//   nodes  one per graph node, id = its key, type = the lowercase node type ('screen', 'variable', ...), the fixed
//          width and height of its box (so React Flow needs no measuring to place or cull them) and the position
//          dagre gave it. `data.graphNode` keeps the variant of the contract.
//   edges  one per graph edge with the built-in 'default' edge type and a style per kind (edgeStyles); the CREATES
//          edge carries the label "origin" of the frame. Edges cannot be focused or selected: the side panel lists the
//          connections of a node for the keyboard.
// onlyUntraced(data) -> the untraced variables, their direct neighbors and the edges between those nodes ("Show
// untraced only", a filter of the client: the contract has none). No edge points to a node that was left out.
import type { Edge, Node } from '@xyflow/react';

import { edgeStyleOf } from './edgeStyles';
import type { GraphData, GraphEdge, GraphNode } from './graphTypes';
import { NODE_SIZE, type Position } from './layout';

export type MapNodeData = { graphNode: GraphNode };
export type MapEdgeData = { graphEdge: GraphEdge };
export type MapFlowNodeType = 'screen' | 'variable' | 'collection' | 'component';
export type MapFlowNode = Node<MapNodeData, MapFlowNodeType>;
export type MapFlowEdge = Edge<MapEdgeData>;

export const ORIGIN_LABEL = 'origin';

export function flowTypeOf(node: GraphNode): MapFlowNodeType {
  switch (node.type) {
    case 'SCREEN':
      return 'screen';
    case 'VARIABLE':
      return 'variable';
    case 'COLLECTION':
      return 'collection';
    case 'COMPONENT':
      return 'component';
  }
}

export function toFlowGraph(
  data: GraphData,
  positions: ReadonlyMap<string, Position>,
): { nodes: MapFlowNode[]; edges: MapFlowEdge[] } {
  const nodes = data.nodes.map<MapFlowNode>((graphNode) => ({
    id: graphNode.key,
    type: flowTypeOf(graphNode),
    position: positions.get(graphNode.key) ?? { x: 0, y: 0 },
    width: NODE_SIZE[graphNode.type].width,
    height: NODE_SIZE[graphNode.type].height,
    data: { graphNode },
    draggable: false,
    connectable: false,
    // Selectable only so React Flow leaves pointer events on: it turns them off for a node that can neither be dragged,
    // selected nor clicked, and the button inside the node would stop answering. The page owns the selection (see
    // MapNodes): React Flow gets no onNodesChange, so its own selection state never changes anything.
    selectable: true,
    focusable: false,
  }));
  const edges = data.edges.map<MapFlowEdge>((graphEdge) => ({
    id: graphEdge.id,
    source: graphEdge.source,
    target: graphEdge.target,
    type: 'default',
    style: edgeStyleOf(graphEdge.kind),
    data: { graphEdge },
    interactionWidth: 14,
    focusable: false,
    selectable: false,
    ...(graphEdge.kind === 'CREATES' ? { label: ORIGIN_LABEL } : {}),
  }));
  return { nodes, edges };
}

export function onlyUntraced(data: GraphData): GraphData {
  const untraced = new Set<string>();
  for (const node of data.nodes) {
    if (node.type === 'VARIABLE' && node.untraced) untraced.add(node.key);
  }
  const visible = new Set(untraced);
  for (const edge of data.edges) {
    if (untraced.has(edge.source)) visible.add(edge.target);
    if (untraced.has(edge.target)) visible.add(edge.source);
  }
  return {
    nodes: data.nodes.filter((node) => visible.has(node.key)),
    edges: data.edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target)),
  };
}

/** App (OnStart) alone, or nothing at all: the application has nothing to draw yet. */
export function isEmptyMap(data: GraphData): boolean {
  return data.nodes.every((node) => node.type === 'SCREEN' && node.isAppContext);
}
