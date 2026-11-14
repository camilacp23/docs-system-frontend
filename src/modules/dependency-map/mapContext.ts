// mapContext: what the nodes of the map need from the page without carrying callbacks in their data.
// MapActionsContext gives the actions of a node: `activate(key)` (a node was chosen: its panel opens, or it takes the
// center in the focus view), `hover(key | null)` (the mouse is over a node or left it) and `focusNode(key | null)` (the
// keyboard focus is on a node or left it). The default does nothing so a node can be rendered alone.
// HighlightContext gives the keys that stay at full strength while a node is hovered, focused or selected, or null when
// nothing is highlighted: every other box is dimmed.
import { createContext } from 'react';

export interface MapActions {
  activate: (key: string) => void;
  hover: (key: string | null) => void;
  focusNode: (key: string | null) => void;
}

export const MapActionsContext = createContext<MapActions>({
  activate: () => undefined,
  hover: () => undefined,
  focusNode: () => undefined,
});

export const HighlightContext = createContext<ReadonlySet<string> | null>(null);

/** The id of the button of a node, so the page can give the focus back to it when the panel closes. */
export function nodeButtonId(key: string): string {
  return `map-node-${key}`;
}
