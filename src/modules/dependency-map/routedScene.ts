// routedScene: puts the lines of a scene on the map.
// absoluteBoxes / routeScene(scene) -> the scene with a route for every line and the bounds of everything that is drawn.
// buildRouted(build) -> builds a scene with the gaps of the layout at 1 x and, if some line found no free lane, again with
//   more room (the lanes of a gap are as many as its width allows), up to a few times, and keeps the best one. A good
//   scene routes every line on the first try: the gaps already grow with the number of lines that cross them.
// degreesOf(edges, unitOf) -> how many lines end at each box; a box grows to give each of them its own port (see grid).
import { routeEdges, type RouteBox, type RouteEdgeInput } from './edgeRouting';
import type { Scene, SceneEdge, SceneNode } from './scene';

/** How much more room each new attempt gives the layout. */
export const GAP_SCALES = [1, 1.5, 2, 3] as const;

export function degreesOf(
  edges: readonly SceneEdge[],
  unitOf: (key: string) => string = (key) => key,
): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const line of edges) {
    const source = unitOf(line.source);
    const target = unitOf(line.target);
    if (source === target) continue;
    degrees.set(source, (degrees.get(source) ?? 0) + 1);
    degrees.set(target, (degrees.get(target) ?? 0) + 1);
  }
  return degrees;
}

/** The boxes of the top level, where they are on the canvas, and the components inside groups. */
export function routingInput(scene: Scene) {
  const byKey = new Map(scene.nodes.map((node) => [node.key, node]));
  const boxes: RouteBox[] = [];
  const children = new Map<string, { box: string; centerY: number }>();
  for (const node of scene.nodes) {
    const parent = node.parentKey === null ? null : byKey.get(node.parentKey);
    if (parent === null || parent === undefined) {
      boxes.push({ key: node.key, x: node.x, y: node.y, width: node.width, height: node.height });
    } else {
      children.set(node.key, { box: parent.key, centerY: parent.y + node.y + node.height / 2 });
    }
  }
  const edges: RouteEdgeInput[] = scene.edges.map((line) => ({
    id: line.id,
    source: line.source,
    target: line.target,
    label: line.label,
    labelFirst: line.labelFirst,
  }));
  return { boxes, children, edges };
}

export function routeScene(scene: Scene): Scene {
  const result = routeEdges(routingInput(scene));
  return {
    ...scene,
    edges: scene.edges.map((line) => ({ ...line, route: result.routes.get(line.id) ?? null })),
    bounds: result.bounds,
    failures: result.failures,
    routingMs: result.durationMs,
  };
}

export function buildRouted(build: (gapScale: number) => Scene): Scene {
  let best: Scene | null = null;
  let routingMs = 0;
  let attempts = 0;
  for (const scale of GAP_SCALES) {
    const scene = routeScene(build(scale));
    attempts += 1;
    routingMs += scene.routingMs;
    if (best === null || scene.failures < best.failures) best = scene;
    if (scene.failures === 0) break;
  }
  return { ...(best as Scene), routingMs, attempts };
}

/** The top-level boxes of a scene (what lines must not cross). */
export function topLevel(nodes: readonly SceneNode[]): SceneNode[] {
  return nodes.filter((node) => node.parentKey === null);
}
