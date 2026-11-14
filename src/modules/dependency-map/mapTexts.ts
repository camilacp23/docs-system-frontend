// mapTexts: the fixed texts of the dependency map that are not in the frames (pending approval, listed in
// docs/design/DESIGN_REFERENCE.md section 9). The texts of the frames are written where they are drawn.
export const EMPTY_MAP_TITLE = 'Nothing to map yet';
export const EMPTY_MAP_TEXT =
  "This application has no documented elements yet. Screens, variables and collections appear here as they're documented.";
export const NO_RESULTS_TITLE = 'No results';
export const NO_RESULTS_TEXT = 'No elements match these filters.';
export const LOAD_FAILED_LEAD = "Couldn't load the dependency map.";
export const NO_CONNECTIONS_TEXT = 'No connections.';
export const FOCUSED_FILTERS_REASON = 'Filters apply to the full map.';
export const ALL_VIEW_ONLY_REASON = 'Available in the All elements view.';
export const TOO_MANY_TITLE = 'Too many elements to draw at once';
export const SHOW_SCREENS_VIEW = 'Show Screens view';
export const VIEW_LABEL = { screens: 'Screens', all: 'All elements' } as const;
export const FOCUS_PATH_LABEL = 'Focus path';

export function tooManyText(count: number, max: number): string {
  return `This map has ${count} elements, more than the ${max} that stay readable. Filter it by type or environment, switch to the Screens view, or pick an element with "Find a node…" to focus on it.`;
}
