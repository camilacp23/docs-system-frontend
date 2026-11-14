// graphModel: from a scene of a view to what React Flow draws.
// sceneToFlow(scene) -> { nodes, edges }
//   nodes  one per box of the scene, id = its key, type = its kind ('screenCard', 'screen', 'screenGroup', 'variable', ..., 'more'),
//          the fixed width and height of its box (so React Flow needs no measuring to place or cull it) and its position.
//          A component of a group has `parentId` and `extent: 'parent'`, so its position is relative to the group and it
//          cannot leave it. `data` keeps the variant of the contract, the counters of a card, the role in the focus view and,
//          for the card "+N more", what it hides.
//   edges  one per drawn line, of the type 'routed' (see RoutedEdge): the path is the route the router found for it (own lane,
//          own ports, never over a box), not one that React Flow computes from the sides of the boxes. Its label is drawn only
//          when `labelShown` says so (the lines that touch the focused element, or any line that is highlighted). Nodes are
//          above the edges, so a line never crosses the text of a box.
// onlyUntraced(data) -> the untraced variables, their direct neighbors and the edges between those nodes ("Show
// untraced only", a filter of the client: the contract has none). No edge points to a node that was left out.
// isEmptyMap(data) -> true for an application with nothing but App (OnStart).
import type { Edge, Node } from '@xyflow/react';

import { edgeStyleOf } from './edgeStyles';
import type { Route } from './edgeRouting';
import type { GraphData, GraphNode } from './graphTypes';
import type { MoreCard, Scene, SceneCounters, SceneEdge, SceneNodeKind } from './scene';

export { ORIGIN_LABEL } from './sceneEdges';

export type MapNodeData = {
  graphNode: GraphNode | null;
  width: number;
  height: number;
  counters: SceneCounters | null;
  role: 'center' | 'left' | 'right' | null;
  more: MoreCard | null;
};
export type MapEdgeData = {
  sceneEdge: SceneEdge;
  route: Route | null;
  labelShown: boolean;
};
export type MapFlowNode = Node<MapNodeData, SceneNodeKind>;
export type MapFlowEdge = Edge<MapEdgeData>;

/** The handles every node has; React Flow needs them to accept an edge, the path itself comes from the route. */
export const HANDLE = {
  leftIn: 'l-in',
  leftOut: 'l-out',
  rightIn: 'r-in',
  rightOut: 'r-out',
} as const;

export function sceneToFlow(scene: Scene): { nodes: MapFlowNode[]; edges: MapFlowEdge[] } {
  const nodes = scene.nodes.map<MapFlowNode>((box) => ({
    id: box.key,
    type: box.kind,
    position: { x: box.x, y: box.y },
    width: box.width,
    height: box.height,
    ...(box.parentKey === null ? {} : { parentId: box.parentKey, extent: 'parent' as const }),
    // Above the edges (which are at 0); a component above its group.
    zIndex: box.parentKey === null ? 1 : 2,
    data: {
      graphNode: box.graphNode,
      width: box.width,
      height: box.height,
      counters: box.counters,
      role: box.role,
      more: box.more,
    },
    draggable: false,
    connectable: false,
    // Selectable only so React Flow leaves pointer events on: it turns them off for a node that can neither be dragged,
    // selected nor clicked, and the button inside the node would stop answering. The page owns the selection (see
    // MapNodes): React Flow gets no onNodesChange, so its own selection state never changes anything.
    selectable: true,
    focusable: false,
  }));
  const edges = scene.edges.flatMap<MapFlowEdge>((line) =>
    line.route === null
      ? []
      : [
          {
            id: line.id,
            source: line.source,
            target: line.target,
            sourceHandle: HANDLE.rightOut,
            targetHandle: HANDLE.leftIn,
            type: 'routed',
            zIndex: 0,
            style: edgeStyleOf(line.kind),
            data: { sceneEdge: line, route: line.route, labelShown: line.labelFirst },
            interactionWidth: 14,
            focusable: false,
            selectable: false,
          },
        ],
  );
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
