// mapContext: what the nodes of the map need from the page without carrying callbacks in their data.
// MapActionsContext gives `select(key)` (a node was chosen: its panel opens). The default does nothing so a node can
// be rendered alone.
import { createContext } from 'react';

export interface MapActions {
  select: (key: string) => void;
}

export const MapActionsContext = createContext<MapActions>({
  select: () => undefined,
});

/** The id of the button of a node, so the page can give the focus back to it when the panel closes. */
export function nodeButtonId(key: string): string {
  return `map-node-${key}`;
}
