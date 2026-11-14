// scene: what a view of the map draws, before React Flow. A view (Screens, focus, All elements) turns the graph of the API
// into a Scene: boxes with a position and a size, and edges between them. Scenes are plain data, so they can be tested
// without drawing anything, and the page memoizes them by the answer of the API.
//   SceneNode  one box. `kind` says how it is drawn: 'screenCard' (a screen with its counters, Screens view), 'screen' (a
//              plain screen), 'screenGroup' (a screen that holds its components), 'variable', 'collection' and 'component'.
//              A component inside a group has `parentKey` and a position RELATIVE to the group; every other box has an
//              absolute position. Groups come before their children, as React Flow needs.
//              'more' is not an element: it is the card "+N more" of a crowded column of the focus view, which expands it.
//   SceneEdge  one drawn line. Parallel edges of the same kind between the same two boxes are ONE SceneEdge with a count
//              and a label; `edges` keeps the original edges (with their real direction) for the tooltip. `route` is where
//              the line runs (see edgeRouting) and `labelFirst` says if its label is shown without hovering (in the focus view
//              only the lines that touch the focused element show theirs).
//   Scene      the boxes, the lines, the rectangle that holds everything that is drawn and, for a view that does not start by
//              showing the whole map, the boxes the first view frames (`fit`) and the one to keep in the middle.
import type { Rect, Route } from './edgeRouting';
import type { EdgeKind, GraphEdge, GraphNode } from './graphTypes';

export type SceneNodeKind =
  'screenCard' | 'screen' | 'screenGroup' | 'variable' | 'collection' | 'component' | 'more';

export interface SceneCounters {
  components: number;
  variables: number;
  collections: number;
}

export interface MoreCard {
  /** The column it belongs to, e.g. "left2". */
  column: string;
  /** How many elements of the column are hidden (collapsed) or were hidden (expanded). */
  hidden: number;
  expanded: boolean;
}

export interface SceneNode {
  key: string;
  kind: SceneNodeKind;
  /** The element; null for the card "+N more". */
  graphNode: GraphNode | null;
  more: MoreCard | null;
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
  labelFirst: boolean;
  route: Route | null;
}

export interface SceneFit {
  /** The boxes the first view frames. */
  keys: string[];
  /** The box that stays in the middle of the view when the framed boxes do not fit it. */
  anchorKey: string | null;
}

export interface Scene {
  nodes: SceneNode[];
  edges: SceneEdge[];
  /** Everything that is drawn: boxes, lines and labels. */
  bounds: Rect;
  fit: SceneFit | null;
  /** How many lines found no free lane (the lines of a good scene all have their own). */
  failures: number;
  /** How long the routing took, all attempts together, and how many attempts it needed (a good scene needs one). */
  routingMs: number;
  attempts: number;
}

export function nodeKindOf(node: GraphNode): Exclude<SceneNodeKind, 'more'> {
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

/** A box with its defaults: not inside a group, no counters, no role and not a "+N more" card. */
export function makeNode(
  node: Pick<SceneNode, 'key' | 'kind' | 'graphNode' | 'x' | 'y' | 'width' | 'height'> &
    Partial<Pick<SceneNode, 'parentKey' | 'counters' | 'role' | 'more'>>,
): SceneNode {
  return { parentKey: null, counters: null, role: null, more: null, ...node };
}

export const NO_BOUNDS = { x: 0, y: 0, width: 0, height: 0 };
