// scene: what a view of the map draws, before React Flow. A view (Screens, focus, All elements) turns the graph of the API
// into a Scene: boxes with a position and a size, and edges between them. Scenes are plain data, so they can be tested
// without drawing anything, and the page memoizes them by the answer of the API.
//   SceneNode  one box. `kind` says how it is drawn: 'screenCard' (a screen with its counters, Screens view), 'screen' (a
//              plain screen), 'screenGroup' (a screen that holds its components), 'variable', 'collection' and 'component'.
//              A component inside a group has `parentKey` and a position RELATIVE to the group; every other box has an
//              absolute position. Groups come before their children, as React Flow needs.
//   SceneEdge  one drawn line. Parallel edges of the same kind between the same two boxes are ONE SceneEdge with a count
//              and a label; `edges` keeps the original edges (with their real direction) for the tooltip.
import type { EdgeKind, GraphEdge, GraphNode } from './graphTypes';

export type SceneNodeKind =
  'screenCard' | 'screen' | 'screenGroup' | 'variable' | 'collection' | 'component';

export interface SceneCounters {
  components: number;
  variables: number;
  collections: number;
}

export interface SceneNode {
  key: string;
  kind: SceneNodeKind;
  graphNode: GraphNode;
  x: number;
  y: number;
  width: number;
  height: number;
  parentKey: string | null;
  counters: SceneCounters | null;
  /** In the focus view: where the box sits relative to the focused element. */
  role: 'center' | 'left' | 'right' | null;
}

export interface SceneEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  label: string | null;
  count: number;
  edges: readonly GraphEdge[];
}

export interface Scene {
  nodes: SceneNode[];
  edges: SceneEdge[];
}

export function nodeKindOf(node: GraphNode): SceneNodeKind {
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
