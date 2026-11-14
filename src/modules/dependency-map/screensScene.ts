// screensScene: the Screens view, the one the map opens with (D-114).
// buildScreensScene(data) -> Scene with ONLY the screens, as cards, and ONLY the NAVIGATES_TO edges between them, placed in
// layers by the navigation with App (OnStart) at the start.
// Each card carries counters computed here, in the client, from the graph already loaded:
//   components   the CONTAINS edges of the screen;
//   variables    the distinct variables of its ACCESSES edges and of its CREATES edges (the links of the origin screen are not
//                ACCESSES edges, because CREATES already represents them, D-104, so a screen that only creates a variable
//                still counts it);
//   collections  the distinct collections of its ACCESSES edges.
// A variable counts once however many places of the screen use it: the number is of elements, not of links.
import type { GraphData } from './graphTypes';
import { computeLayout, SCREEN_CARD_SIZE } from './layout';
import { groupEdges } from './sceneEdges';
import type { Scene, SceneCounters, SceneNode } from './scene';

export function screenCounters(data: GraphData): Map<string, SceneCounters> {
  const typeOf = new Map(data.nodes.map((node) => [node.key, node.type]));
  const components = new Map<string, number>();
  const variables = new Map<string, Set<string>>();
  const collections = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, screen: string, target: string) => {
    const set = map.get(screen);
    if (set) set.add(target);
    else map.set(screen, new Set([target]));
  };
  for (const edge of data.edges) {
    if (edge.kind === 'CONTAINS') {
      components.set(edge.source, (components.get(edge.source) ?? 0) + 1);
    } else if (edge.kind === 'ACCESSES' || edge.kind === 'CREATES') {
      const targetType = typeOf.get(edge.target);
      if (targetType === 'VARIABLE') add(variables, edge.source, edge.target);
      else if (targetType === 'COLLECTION' && edge.kind === 'ACCESSES') {
        add(collections, edge.source, edge.target);
      }
    }
  }
  const counters = new Map<string, SceneCounters>();
  for (const node of data.nodes) {
    if (node.type !== 'SCREEN') continue;
    counters.set(node.key, {
      components: components.get(node.key) ?? 0,
      variables: variables.get(node.key)?.size ?? 0,
      collections: collections.get(node.key)?.size ?? 0,
    });
  }
  return counters;
}

export function buildScreensScene(data: GraphData): Scene {
  const screens = data.nodes.filter((node) => node.type === 'SCREEN');
  const screenKeys = new Set(screens.map((node) => node.key));
  const navigation = data.edges.filter(
    (edge) =>
      edge.kind === 'NAVIGATES_TO' && screenKeys.has(edge.source) && screenKeys.has(edge.target),
  );
  const firstKey = screens.find((node) => node.isAppContext)?.key;
  const { positions } = computeLayout(
    { nodes: screens, edges: navigation },
    () => SCREEN_CARD_SIZE,
    {
      firstKey,
    },
  );
  const counters = screenCounters(data);

  const nodes: SceneNode[] = screens.map((graphNode) => {
    const position = positions.get(graphNode.key) ?? { x: 0, y: 0 };
    return {
      key: graphNode.key,
      kind: 'screenCard',
      graphNode,
      x: position.x,
      y: position.y,
      width: SCREEN_CARD_SIZE.width,
      height: SCREEN_CARD_SIZE.height,
      parentKey: null,
      counters: counters.get(graphNode.key) ?? null,
      role: null,
    };
  });
  return { nodes, edges: groupEdges(navigation, 'none') };
}
