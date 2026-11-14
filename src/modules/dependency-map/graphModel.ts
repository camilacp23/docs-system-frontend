// graphModel: from a scene of a view to what React Flow draws.
// sceneToFlow(scene) -> { nodes, edges }
//   nodes  one per box of the scene, id = its key, type = its kind ('screenCard', 'screen', 'screenGroup', 'variable', ...),
//          the fixed width and height of its box (so React Flow needs no measuring to place or cull it) and its position.
//          A component of a group has `parentId` and `extent: 'parent'`, so its position is relative to the group and it
//          cannot leave it. `data` keeps the variant of the contract, the counters of a card and the role in the focus view.
//   edges  one per drawn line, a 'smoothstep' (steps) with the style of its kind (edgeStyles) and the label of the scene. A
//          line that goes from left to right leaves the right side of its source and enters the left side of its target; a
//          line whose source is to the RIGHT of its target (a screen that reads an element, which sits on its left) leaves
//          the left side of the source and enters the right side of the target, so it is short and direct instead of
//          looping around the boxes. The edge keeps its real direction: only the sides it is drawn from change. Nodes are above
//          the edges, so a line never crosses the text of a box; the scene edge
//          (with the original edges it groups) goes in `data` for the tooltip.
// onlyUntraced(data) -> the untraced variables, their direct neighbors and the edges between those nodes ("Show
// untraced only", a filter of the client: the contract has none). No edge points to a node that was left out.
// isEmptyMap(data) -> true for an application with nothing but App (OnStart).
import type { Edge, Node } from '@xyflow/react';

import { edgeStyleOf } from './edgeStyles';
import type { GraphData, GraphNode } from './graphTypes';
import type { Scene, SceneCounters, SceneEdge, SceneNodeKind } from './scene';

export { ORIGIN_LABEL } from './sceneEdges';

export type MapNodeData = {
  graphNode: GraphNode;
  width: number;
  height: number;
  counters: SceneCounters | null;
  role: 'center' | 'left' | 'right' | null;
};
/** The ids of the four handles of a node: in and out, on each side. See MapNodes. */
export const HANDLE = {
  leftIn: 'l-in',
  leftOut: 'l-out',
  rightIn: 'r-in',
  rightOut: 'r-out',
} as const;

export type MapEdgeData = { sceneEdge: SceneEdge };
export type MapFlowNode = Node<MapNodeData, SceneNodeKind>;
export type MapFlowEdge = Edge<MapEdgeData>;

export function sceneToFlow(scene: Scene): { nodes: MapFlowNode[]; edges: MapFlowEdge[] } {
  // Where each box is on the canvas: a component of a group has a position relative to the group.
  const parents = new Map(scene.nodes.map((box) => [box.key, box]));
  const centerX = new Map<string, number>();
  for (const box of scene.nodes) {
    const parent = box.parentKey === null ? null : parents.get(box.parentKey);
    centerX.set(box.key, box.x + (parent?.x ?? 0) + box.width / 2);
  }

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
    },
    draggable: false,
    connectable: false,
    // Selectable only so React Flow leaves pointer events on: it turns them off for a node that can neither be dragged,
    // selected nor clicked, and the button inside the node would stop answering. The page owns the selection (see
    // MapNodes): React Flow gets no onNodesChange, so its own selection state never changes anything.
    selectable: true,
    focusable: false,
  }));
  const edges = scene.edges.map<MapFlowEdge>((line) => {
    const backwards = (centerX.get(line.source) ?? 0) > (centerX.get(line.target) ?? 0);
    return {
      id: line.id,
      source: line.source,
      target: line.target,
      sourceHandle: backwards ? HANDLE.leftOut : HANDLE.rightOut,
      targetHandle: backwards ? HANDLE.rightIn : HANDLE.leftIn,
      type: 'smoothstep',
      zIndex: 0,
      style: edgeStyleOf(line.kind),
      data: { sceneEdge: line },
      interactionWidth: 14,
      focusable: false,
      selectable: false,
      ...(line.label === null ? {} : { label: line.label }),
    };
  });
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
