// screenGroups: screens that hold their components (the group nodes of the focus and All elements views).
// componentsByScreen(data) -> Map from a screen key to its components, only for the screens that are in the graph and have
//   at least one component in it. A component whose screen is not in the graph (the `types` filter left the screens out)
//   belongs to no group and is drawn alone.
// unitKeyOf(node, groups) -> the key of the box a node lives in: its screen when it is a component of a group, else itself.
// groupLayout(childCount) -> the size of the group and the position of each child inside it (relative to the group): a
//   header with the screen, then the components in a grid of 1, 2 or 3 columns, so a screen with many components stays
//   compact. The size depends only on the number of components, so it is known before the map is placed.
import type { ComponentNode, GraphData, GraphNode } from './graphTypes';
import { NODE_SIZE, type NodeSize, type Position } from './layout';

export const GROUP_HEADER = 44;
export const GROUP_PADDING = 12;
export const CHILD_GAP = 8;

export function componentsByScreen(data: GraphData): Map<string, ComponentNode[]> {
  const screens = new Set<string>();
  for (const node of data.nodes) if (node.type === 'SCREEN') screens.add(node.key);
  const groups = new Map<string, ComponentNode[]>();
  for (const node of data.nodes) {
    if (node.type !== 'COMPONENT') continue;
    const screenKey = `screen:${node.screenId}`;
    if (!screens.has(screenKey)) continue;
    const list = groups.get(screenKey);
    if (list) list.push(node);
    else groups.set(screenKey, [node]);
  }
  return groups;
}

export function unitKeyOf(
  node: GraphNode,
  groups: ReadonlyMap<string, readonly ComponentNode[]>,
): string {
  if (node.type === 'COMPONENT') {
    const screenKey = `screen:${node.screenId}`;
    if (groups.has(screenKey)) return screenKey;
  }
  return node.key;
}

export interface GroupLayout extends NodeSize {
  positions: Position[];
}

export function groupColumns(childCount: number): number {
  return childCount <= 4 ? 1 : childCount <= 12 ? 2 : 3;
}

export function groupLayout(childCount: number): GroupLayout {
  const child = NODE_SIZE.COMPONENT;
  const columns = groupColumns(childCount);
  const rows = Math.ceil(childCount / columns);
  const gridWidth = columns * child.width + (columns - 1) * CHILD_GAP;
  const width = Math.max(NODE_SIZE.SCREEN.width, gridWidth + 2 * GROUP_PADDING);
  const height = GROUP_HEADER + rows * child.height + (rows - 1) * CHILD_GAP + 2 * GROUP_PADDING;
  const left = Math.round((width - gridWidth) / 2);
  const positions = Array.from({ length: childCount }, (_, index) => ({
    x: left + (index % columns) * (child.width + CHILD_GAP),
    y: GROUP_HEADER + GROUP_PADDING + Math.floor(index / columns) * (child.height + CHILD_GAP),
  }));
  return { width, height, positions };
}
