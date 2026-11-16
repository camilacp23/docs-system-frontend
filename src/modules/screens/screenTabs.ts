// screenTabs: the tabs of the screen detail and the value each one takes in the URL (`/screens/:id?tab=<key>`).
// SCREEN_TAB_KEYS lists them in the order they are drawn; Template is the default and leaves no parameter.
// COMPONENTS_TAB is the "Components & navigation" tab: the pages that link to the components of a screen (the
// dependency map, D-102) use it instead of writing the text by hand.
export type ScreenTabKey = 'template' | 'components' | 'links' | 'todo' | 'comments';

export const SCREEN_TAB_KEYS: readonly ScreenTabKey[] = [
  'template',
  'components',
  'links',
  'todo',
  'comments',
];

export const COMPONENTS_TAB: ScreenTabKey = 'components';
