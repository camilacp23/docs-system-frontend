// highlight: which boxes and lines stay at full strength while a node is hovered, focused with the keyboard or selected.
// computeHighlight(scene, activeKey) -> { nodes, edges } (keys of boxes, ids of lines) or null when there is no active node.
// The active box, the boxes it is connected to and the lines between them stay; every other box and line is dimmed. A
// screen group counts its components: a line that starts or ends at a component of the group is a line of the group, and
// a component brings its group with it, so the highlight never leaves a box dimmed inside one at full strength.
import type { Scene } from './scene';

export interface Highlight {
  nodes: ReadonlySet<string>;
  edges: ReadonlySet<string>;
}

export const DIMMED_OPACITY = 0.15;

export function computeHighlight(scene: Scene, activeKey: string | null): Highlight | null {
  if (activeKey === null) return null;
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const known = new Set<string>();
  for (const box of scene.nodes) {
    known.add(box.key);
    if (box.parentKey !== null) {
      parentOf.set(box.key, box.parentKey);
      const list = childrenOf.get(box.parentKey);
      if (list) list.push(box.key);
      else childrenOf.set(box.parentKey, [box.key]);
    }
  }
  if (!known.has(activeKey)) return null;

  // The boxes whose lines are the lines of the active node: itself and, for a group, its components.
  const members = new Set<string>([activeKey, ...(childrenOf.get(activeKey) ?? [])]);
  const nodes = new Set<string>(members);
  const parent = parentOf.get(activeKey);
  if (parent !== undefined) nodes.add(parent);

  const edges = new Set<string>();
  for (const line of scene.edges) {
    if (!members.has(line.source) && !members.has(line.target)) continue;
    edges.add(line.id);
    for (const end of [line.source, line.target]) {
      nodes.add(end);
      const group = parentOf.get(end);
      if (group !== undefined) nodes.add(group);
    }
  }
  return { nodes, edges };
}
