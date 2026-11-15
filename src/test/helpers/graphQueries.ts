// graphQueries: what the dependency endpoints do to a graph, as pure functions with no test-runner imports, so the fake API
// of the tests and the development page of the map (/dev/map) answer exactly alike.
// filterGraph(graph, { types, environment }, environments) -> the graph the API would return for `types` and `environment`
//   (D-104 a): `types` keeps those node types, `environment` keeps the variables and collections present in it (a node
//   without an entry in `environments` is in DEV and PROD) and leaves screens and components alone, and an edge whose end was
//   left out is removed, so there is never a dangling edge.
// neighborhoodOf(graph, startKey, depth) -> the node and what is reachable in at most `depth` steps, both directions and safe
//   against cycles, with every edge between those nodes (D-104 e). The order of the graph is kept.
import type { Environment, GraphData, NodeType } from '../../modules/dependency-map/graphTypes';

export interface GraphFilter {
  types?: readonly NodeType[] | null;
  environment?: Environment | null;
}

export function filterGraph(
  graph: GraphData,
  filter: GraphFilter,
  environments: Record<string, readonly Environment[]> = {},
): GraphData {
  const keep = new Set<string>();
  for (const node of graph.nodes) {
    if (filter.types && !filter.types.includes(node.type)) continue;
    if (filter.environment && (node.type === 'VARIABLE' || node.type === 'COLLECTION')) {
      const present = environments[node.key] ?? ['DEV', 'PROD'];
      if (!present.includes(filter.environment)) continue;
    }
    keep.add(node.key);
  }
  return {
    nodes: graph.nodes.filter((node) => keep.has(node.key)),
    edges: graph.edges.filter((edge) => keep.has(edge.source) && keep.has(edge.target)),
  };
}

export function neighborhoodOf(graph: GraphData, startKey: string, depth: number): GraphData {
  const reached = new Set<string>([startKey]);
  let frontier = [startKey];
  for (let step = 0; step < depth; step += 1) {
    const next: string[] = [];
    for (const edge of graph.edges) {
      for (const [from, to] of [
        [edge.source, edge.target],
        [edge.target, edge.source],
      ] as const) {
        if (frontier.includes(from) && !reached.has(to)) {
          reached.add(to);
          next.push(to);
        }
      }
    }
    frontier = next;
  }
  return {
    nodes: graph.nodes.filter((node) => reached.has(node.key)),
    edges: graph.edges.filter((edge) => reached.has(edge.source) && reached.has(edge.target)),
  };
}
