// filterTones: the color of an active filter pill by page (see FilterSelect and FilterToggle).
export type FilterTone =
  'variable' | 'collection' | 'screen' | 'accent' | 'audit' | 'people' | 'apps' | 'map' | 'find';

/** Written out so Tailwind finds the classes. */
export const FILTER_TONE_ACTIVE: Record<FilterTone, string> = {
  variable: 'border-variable bg-variable-soft text-variable-ink',
  collection: 'border-collection bg-collection-soft text-collection-ink',
  screen: 'border-screen bg-screen-soft text-screen-ink',
  accent: 'border-accent bg-accent-soft text-accent-ink',
  audit: 'border-audit bg-audit-soft text-audit-ink',
  people: 'border-people bg-people-soft text-people-ink',
  apps: 'border-apps bg-apps-soft text-apps-ink',
  map: 'border-map bg-map-soft text-map-ink',
  find: 'border-find bg-find-soft text-find-ink',
};

/** Keyboard focus inside the pill: the same tint as hover (no outline ring around it). */
export const FILTER_TONE_FOCUS: Record<FilterTone, string> = {
  variable: 'has-focus-visible:border-variable has-focus-visible:bg-variable-soft',
  collection: 'has-focus-visible:border-collection has-focus-visible:bg-collection-soft',
  screen: 'has-focus-visible:border-screen has-focus-visible:bg-screen-soft',
  accent: 'has-focus-visible:border-accent has-focus-visible:bg-accent-soft',
  audit: 'has-focus-visible:border-audit has-focus-visible:bg-audit-soft',
  people: 'has-focus-visible:border-people has-focus-visible:bg-people-soft',
  apps: 'has-focus-visible:border-apps has-focus-visible:bg-apps-soft',
  map: 'has-focus-visible:border-map has-focus-visible:bg-map-soft',
  find: 'has-focus-visible:border-find has-focus-visible:bg-find-soft',
};

export const FILTER_TONE_HOVER: Record<FilterTone, string> = {
  variable: 'hover:border-variable-border hover:bg-variable-soft',
  collection: 'hover:border-collection-border hover:bg-collection-soft',
  screen: 'hover:border-screen-border hover:bg-screen-soft',
  accent: 'hover:border-info-border hover:bg-accent-soft',
  audit: 'hover:border-audit-border hover:bg-audit-soft',
  people: 'hover:border-people-border hover:bg-people-soft',
  apps: 'hover:border-apps-border hover:bg-apps-soft',
  map: 'hover:border-map-border hover:bg-map-soft',
  find: 'hover:border-find-border hover:bg-find-soft',
};

/** Focus on the input itself (a pill that is an input, not a wrapper of one). */
export const FILTER_TONE_INPUT_FOCUS: Record<FilterTone, string> = {
  variable: 'focus:border-variable focus:bg-variable-soft',
  collection: 'focus:border-collection focus:bg-collection-soft',
  screen: 'focus:border-screen focus:bg-screen-soft',
  accent: 'focus:border-accent focus:bg-accent-soft',
  audit: 'focus:border-audit focus:bg-audit-soft',
  people: 'focus:border-people focus:bg-people-soft',
  apps: 'focus:border-apps focus:bg-apps-soft',
  map: 'focus:border-map focus:bg-map-soft',
  find: 'focus:border-find focus:bg-find-soft',
};
