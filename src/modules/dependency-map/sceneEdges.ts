// sceneEdges: parallel edges become one.
// groupEdges(edges, labels) -> SceneEdge[]: the edges of the same kind between the same two boxes (same source, same target)
// are ONE line with a count and a label, in the order the first of each group appears. Edges that differ in kind or direction
// stay apart: the direction of an edge is always its real one.
//   labels 'all'     (focus view) every edge has a label: the access mode(s) of ACCESSES ("Read", "Read / Write",
//                    "Read · Write ×2"), the assignment function(s) of FEEDS ("Set", "Set · UpdateContext ×3"), "origin" for
//                    CREATES and "×N" for the others when there are several.
//   labels 'counts'  (All elements) only "×N" when several edges were grouped: the modes would crowd the map.
//   labels 'none'    (Screens) no labels.
// The label text uses the words of the frames; the access mode of READ_WRITE reads "Read / Write" here.
import { ACCESS_EDGE_LABEL, ASSIGNMENT_FUNCTION_LABEL } from './graphLabels';
import type { GraphEdge } from './graphTypes';
import type { SceneEdge } from './scene';

export type EdgeLabels = 'all' | 'counts' | 'none';

export const ORIGIN_LABEL = 'origin';

const ACCESS_ORDER = ['READ', 'WRITE', 'READ_WRITE'] as const;
const FUNCTION_ORDER = ['SET', 'UPDATE_CONTEXT'] as const;

function labelOf(edges: readonly GraphEdge[], labels: EdgeLabels): string | null {
  if (labels === 'none') return null;
  const count = edges.length;
  const times = count > 1 ? ` ×${count}` : '';
  if (labels === 'counts') return count > 1 ? `×${count}` : null;
  const first = edges[0];
  if (first === undefined) return null;
  switch (first.kind) {
    case 'ACCESSES': {
      const modes = new Set(
        edges.map((edge) => (edge.kind === 'ACCESSES' ? edge.accessMode : null)),
      );
      return `${ACCESS_ORDER.filter((mode) => modes.has(mode))
        .map((mode) => ACCESS_EDGE_LABEL[mode])
        .join(' · ')}${times}`;
    }
    case 'FEEDS': {
      const functions = new Set(
        edges.map((edge) => (edge.kind === 'FEEDS' ? edge.assignmentFunction : null)),
      );
      return `${FUNCTION_ORDER.filter((name) => functions.has(name))
        .map((name) => ASSIGNMENT_FUNCTION_LABEL[name])
        .join(' · ')}${times}`;
    }
    case 'CREATES':
      return `${ORIGIN_LABEL}${times}`;
    default:
      return count > 1 ? `×${count}` : null;
  }
}

export function groupEdges(
  edges: readonly GraphEdge[],
  labels: EdgeLabels,
  labelFirst: (edge: GraphEdge) => boolean = () => true,
): SceneEdge[] {
  const groups = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const key = `${edge.kind}|${edge.source}|${edge.target}`;
    const group = groups.get(key);
    if (group) group.push(edge);
    else groups.set(key, [edge]);
  }
  return [...groups.values()].map((group) => {
    const first = group[0] as GraphEdge;
    return {
      id: first.id,
      source: first.source,
      target: first.target,
      kind: first.kind,
      label: labelOf(group, labels),
      count: group.length,
      edges: group,
      labelFirst: labelFirst(first),
      route: null,
    };
  });
}
