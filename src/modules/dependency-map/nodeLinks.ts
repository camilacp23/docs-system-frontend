// nodeLinks: where a node of the map leads (FR-16).
// elementHref(target) -> the route of the page of an element; the map and the advanced search both use it, so where
// each type leads is written once. nodeHref(node) -> the same for a node of the map:
//   variable   /variables/:id        collection /collections/:id       screen /screens/:id
//   component  /screens/:screenId?tab=<COMPONENTS_TAB>  (D-102): a component has no page of its own, so it leads to
//              the "Components & navigation" tab of its screen, using the `screenId` of the node itself, which is there
//              even when the `types` filter left the screens out of the graph (D-104 f).
// nodeOpenLabel(node) -> the text of the button ("Open screen", "Open variable", "Open collection").
// miroHrefOf(node) -> the Miro diagram of a screen node when it is an https address, otherwise null: the contract only
// accepts https and a stored value of another kind is never made clickable.
import { COMPONENTS_TAB } from '../screens/screenTabs';
import { isHttpsUrl } from '../screens/httpsUrl';

import type { GraphNode } from './graphTypes';

/** The element a link leads to: a component has no page of its own, so it is identified by its screen. */
export type ElementTarget =
  | { type: 'SCREEN' | 'VARIABLE' | 'COLLECTION'; id: number }
  | { type: 'COMPONENT'; screenId: number };

/** The route of the page of an element; the one place that knows where each type leads (the map and the search use it). */
export function elementHref(target: ElementTarget): string {
  switch (target.type) {
    case 'SCREEN':
      return `/screens/${target.id}`;
    case 'VARIABLE':
      return `/variables/${target.id}`;
    case 'COLLECTION':
      return `/collections/${target.id}`;
    case 'COMPONENT':
      return `/screens/${target.screenId}?tab=${COMPONENTS_TAB}`;
  }
}

export function nodeHref(node: GraphNode): string {
  return node.type === 'COMPONENT'
    ? elementHref({ type: 'COMPONENT', screenId: node.screenId })
    : elementHref({ type: node.type, id: node.id });
}

export function nodeOpenLabel(node: GraphNode): string {
  switch (node.type) {
    case 'SCREEN':
    case 'COMPONENT':
      return 'Open screen';
    case 'VARIABLE':
      return 'Open variable';
    case 'COLLECTION':
      return 'Open collection';
  }
}

export function miroHrefOf(node: GraphNode): string | null {
  return node.type === 'SCREEN' && isHttpsUrl(node.miroLink) ? node.miroLink : null;
}
