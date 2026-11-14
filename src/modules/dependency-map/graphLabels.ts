// graphLabels: the words the map uses for node types, edge kinds, access modes and assignment functions.
// Texts of the frames S-27 to S-28 (legend and side panel); the access labels follow the collection card of S-15a.
import type { components } from '../../api/schema';

import type { EdgeKind, NodeType } from './graphTypes';

export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  SCREEN: 'Screen',
  VARIABLE: 'Variable',
  COLLECTION: 'Collection',
  COMPONENT: 'Component',
};

/** The plural used by the type filter (frame S-27: "Screens", "Variables", "Collections", "Components"). */
export const NODE_TYPE_PLURAL_LABEL: Record<NodeType, string> = {
  SCREEN: 'Screens',
  VARIABLE: 'Variables',
  COLLECTION: 'Collections',
  COMPONENT: 'Components',
};

/** The legend of S-27c. */
export const EDGE_KIND_LABEL: Record<EdgeKind, string> = {
  CONTAINS: 'Contains',
  CREATES: 'Creates',
  ACCESSES: 'Accesses',
  FEEDS: 'Feeds',
  USES: 'Uses',
  DERIVES_FROM: 'Derives from',
  NAVIGATES_TO: 'Navigates to',
};

type AccessMode = components['schemas']['AccessMode'];
type AssignmentFunction = components['schemas']['AssignmentFunction'];

export const ACCESS_MODE_LABEL: Record<AccessMode, string> = {
  READ: 'Read',
  WRITE: 'Write',
  READ_WRITE: 'Read-write',
};

/** The access mode on a drawn edge (focus view): READ_WRITE reads "Read / Write" there. */
export const ACCESS_EDGE_LABEL: Record<AccessMode, string> = {
  READ: 'Read',
  WRITE: 'Write',
  READ_WRITE: 'Read / Write',
};

export const ASSIGNMENT_FUNCTION_LABEL: Record<AssignmentFunction, string> = {
  SET: 'Set',
  UPDATE_CONTEXT: 'UpdateContext',
};

export const UNTRACED_TAG_LABEL = 'Untraced';

/** The label of the focused element, on its card. */
export const FOCUSED_LABEL = 'Focused';
/** The card of a crowded column of the focus view: "+8 more", and "Show fewer" once it is open. */
export const moreLabel = (hidden: number): string => `+${hidden} more`;
export const SHOW_FEWER_LABEL = 'Show fewer';
